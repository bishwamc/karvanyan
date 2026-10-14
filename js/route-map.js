/**
 * route-map.js: the journey map (approximate, stylised; not to scale).
 *
 * Pure geometry lives here so Node can test it. The painter only draws what the geometry returns.
 * Coordinates are approximate latitude and longitude from general knowledge, not surveyed.
 * The game's road is a simplified line through these stops, so the map shows progress, not the true road.
 */
(function (namespace) {
  'use strict';

  const World = namespace.World;

  /** [latitude, longitude] per stop. APPROXIMATE. Every stop in World.NODES must appear here (tested). */
  const APPROX_COORDS = Object.freeze({
    kabul: [34.53, 69.17], jalalabad: [34.43, 70.45], khyber: [34.10, 71.13], peshawar: [34.01, 71.58],
    attock: [33.77, 72.36], hasan_abdal: [33.80, 72.69], rohtas: [32.96, 73.58], jhelum: [32.93, 73.73],
    gujrat: [32.57, 74.08], lahore: [31.55, 74.34], amritsar: [31.63, 74.87], jalandhar: [31.33, 75.58],
    ludhiana: [30.90, 75.85], sirhind: [30.64, 76.39], ambala: [30.38, 76.78], karnal: [29.69, 76.99],
    panipat: [29.39, 76.97], delhi: [28.61, 77.21], mathura: [27.49, 77.67], agra: [27.18, 78.02],
    etawah: [26.78, 79.02], fatehpur: [25.93, 80.81], allahabad: [25.43, 81.85], varanasi: [25.32, 83.01],
    sasaram: [24.95, 84.03], patna: [25.61, 85.14], munger: [25.37, 86.47], bhagalpur: [25.24, 86.97],
    rajmahal: [25.05, 87.85], makhsusabad: [24.18, 88.27], dhaka: [23.81, 90.41],
  });

  const PALETTE = Object.freeze({ paper: '#f1e6cf', red: '#a63a24', ink: '#14233a', faint: '#8a7a5c' });

  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

  function coordsOf(nodeId) {
    return APPROX_COORDS[nodeId] || null;
  }

  /** Every stop along the road from the start to the final stop, in order. */
  function getFullRouteIds() {
    const ids = [World.FIRST_NODE_ID];
    let guard = 0;
    while (ids[ids.length - 1] !== World.FINAL_NODE_ID && guard < World.NODES.length) {
      const edge = World.getOutgoingEdges(ids[ids.length - 1])[0];
      if (!edge) break;
      ids.push(edge.to);
      guard += 1;
    }
    return ids;
  }

  /**
   * What the map needs to show for a game state: the stops reached, the current position, and kos travelled.
   * @param {{nodeId:string, edgeId:(string|null), kosOnEdge:number, phase:string}} state
   */
  function getJourneyTrail(state) {
    const stopIds = [World.FIRST_NODE_ID];
    let kosBeforeCurrentStop = 0;
    let guard = 0;
    while (stopIds[stopIds.length - 1] !== state.nodeId && guard < World.NODES.length) {
      const edge = World.getOutgoingEdges(stopIds[stopIds.length - 1])[0];
      if (!edge) break;
      kosBeforeCurrentStop += edge.kos;
      stopIds.push(edge.to);
      guard += 1;
    }

    let head = coordsOf(state.nodeId);
    let kosTravelled = kosBeforeCurrentStop;
    const edge = state.edgeId ? World.findEdge(state.edgeId) : null;
    if (edge && edge.from === state.nodeId && edge.kos > 0) {
      const fraction = clamp((state.kosOnEdge || 0) / edge.kos, 0, 1);
      head = lerp(coordsOf(edge.from), coordsOf(edge.to), fraction);
      kosTravelled += Math.min(edge.kos, state.kosOnEdge || 0);
    }

    const stops = stopIds.map((id) => {
      const node = World.findNode(id);
      return { id, name: node.name, region: node.region, coords: coordsOf(id) };
    });
    const regionsReached = new Set(stops.map((stop) => stop.region)).size;

    return {
      stops,
      head,
      kosTravelled: Math.round(kosTravelled * 10) / 10,
      totalKos: World.TOTAL_KOS,
      regionsReached,
      isFinished: state.phase === 'ended',
    };
  }

  /**
   * Returns the region just entered when the caravan moves from one stop to another, or null.
   * @returns {{from:string, to:string, name:string}|null}
   */
  function getRegionChange(previousNodeId, nodeId) {
    if (!previousNodeId || !nodeId || previousNodeId === nodeId) return null;
    const from = World.findNode(previousNodeId).region;
    const to = World.findNode(nodeId).region;
    if (from === to) return null;
    return { from, to, name: World.getRegion(to).name };
  }

  /** Builds a projection that keeps the map's proportions and fits the canvas with a margin. */
  function makeProjector(width, height, margin) {
    const ids = Object.keys(APPROX_COORDS);
    const lats = ids.map((id) => APPROX_COORDS[id][0]);
    const lons = ids.map((id) => APPROX_COORDS[id][1]);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLon = Math.min(...lons), maxLon = Math.max(...lons);
    const lonScale = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
    const spanX = (maxLon - minLon) * lonScale;
    const spanY = maxLat - minLat;
    const scale = Math.min((width - 2 * margin) / spanX, (height - 2 * margin) / spanY);
    const offsetX = (width - spanX * scale) / 2;
    const offsetY = (height - spanY * scale) / 2;
    return ([lat, lon]) => [offsetX + (lon - minLon) * lonScale * scale, offsetY + (maxLat - lat) * scale];
  }

  /**
   * Draws the map: the whole road as a faint dotted line, the travelled part as a red line,
   * stops as dots, and the caravan as a marker. Only reached stops are labelled.
   * @param {CanvasRenderingContext2D} ctx
   */
  function paintJourneyMap(ctx, trail, width, height) {
    const project = makeProjector(width, height, 28);
    const fullRoute = getFullRouteIds().map((id) => coordsOf(id)).filter(Boolean);
    const travelled = trail.stops.map((stop) => stop.coords).concat(trail.isFinished ? [] : [trail.head]);

    ctx.save();
    ctx.fillStyle = PALETTE.paper;
    ctx.fillRect(0, 0, width, height);

    const strokePath = (points) => {
      if (points.length < 2) return;
      ctx.beginPath();
      points.forEach((point, index) => {
        const [x, y] = project(point);
        if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    };

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.setLineDash([3, 5]);
    ctx.strokeStyle = PALETTE.faint;
    ctx.lineWidth = 2;
    strokePath(fullRoute);
    ctx.setLineDash([]);

    ctx.strokeStyle = PALETTE.red;
    ctx.lineWidth = 3.5;
    ctx.shadowColor = 'rgba(166, 58, 36, 0.35)';
    ctx.shadowBlur = 6;
    strokePath(travelled);
    ctx.shadowBlur = 0;

    ctx.font = '17px Georgia, "Times New Roman", serif';
    ctx.textBaseline = 'middle';
    // Labels that would sit on top of an earlier label are skipped; the start and end are always labelled.
    const placedLabels = [];
    const LABEL_CLEARANCE = 70;
    trail.stops.forEach((stop, index) => {
      const [x, y] = project(stop.coords);
      const isEndpoint = index === 0 || index === trail.stops.length - 1;
      ctx.fillStyle = PALETTE.paper;
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, isEndpoint ? 4.5 : 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      const clashes = placedLabels.some(([px, py]) => Math.hypot(px - x, py - y) < LABEL_CLEARANCE);
      if (clashes && !isEndpoint) return;
      placedLabels.push([x, y]);
      ctx.fillStyle = PALETTE.ink;
      const isCurrent = index === trail.stops.length - 1 && !trail.isFinished;
      // Labels that would run off the right edge are drawn to the left of the stop instead.
      const labelWidth = ctx.measureText(stop.name).width;
      const flipLeft = x + 7 + labelWidth > width - 4;
      ctx.textAlign = flipLeft ? 'right' : 'left';
      ctx.fillText(stop.name, flipLeft ? x - 7 : x + (isCurrent ? 14 : 7), y - (isCurrent ? 0 : 6));
      ctx.textAlign = 'left';
    });

    if (!trail.isFinished) {
      const [hx, hy] = project(trail.head);
      ctx.fillStyle = PALETTE.red;
      ctx.beginPath(); ctx.arc(hx, hy, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(hx, hy, 10, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  namespace.RouteMap = Object.freeze({
    APPROX_COORDS, getFullRouteIds, getJourneyTrail, getRegionChange, paintJourneyMap,
  });
})(window.Karvanyan);
