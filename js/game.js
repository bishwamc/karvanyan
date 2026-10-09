/**
 * game.js — core loop, provisioning minigame (hunt, fish, forage) and the app coordinator.
 *
 *   1. Provisioning minigame (GDD 8): one shared "spot and strike" core with three skins.
 *   2. App: the opening flow, the animation loop that ticks road days, every button action,
 *      autosave and boot. All rules live in engine.js and events.js; this file only wires
 *      state, UI and storage together.
 */
(function (namespace) {
  'use strict';

  const Config = namespace.Config;
  const World = namespace.World;
  const Content = namespace.Content;
  const State = namespace.State;
  const Engine = namespace.Engine;
  const Events = namespace.Events;
  const UI = () => namespace.UI;

  // ===========================================================================
  // 1. PROVISIONING MINIGAME
  // ===========================================================================

  /**
   * Plays one 20-second provisioning session on a canvas. Works with touch, mouse and keyboard.
   * Hit areas are at least 48 CSS pixels; a hunter in the party and the assist setting enlarge them.
   *
   * @param {{canvas:HTMLCanvasElement, skin:'hunt'|'fish'|'forage', durationSeconds:number, targetScale:number,
   *   isStill:boolean, random:Object, weatherKey:string,
   *   onUpdate:(text:string)=>void, onFinish:(score:number)=>void}} options
   * @returns {{stop:()=>void, finishNow:()=>void}}
   */
  function startProvisionSession(options) {
    const width = Config.CANVAS.LOGICAL_WIDTH;
    const height = Config.CANVAS.LOGICAL_HEIGHT;
    const settings = Config.PROVISION;
    const KEYBOARD_STEP = 10;
    const random = options.random;
    const skin = options.skin;
    let secondsLeft = options.durationSeconds;
    let score = { hits: 0, attempts: settings.HUNT_ATTEMPTS, picks: 0, scares: 0 };
    let crosshair = { x: width / 2, y: height / 2, isVisible: false };
    let message = 'Ready!';
    let isFinished = false;
    let animationHandle = 0;
    let lastTimestamp = null;
    let flash = null;
    const isFoggy = options.weatherKey === 'fog';

    const spawnAnimal = () => ({ x: random.range(30, width - 30), y: random.range(90, height - 20), speed: random.range(18, 38), direction: random.chance(0.5) ? 1 : -1, alpha: 1, relocateIn: 1.6 });
    const spawnFish = () => ({ x: random.range(30, width - 30), y: random.range(100, height - 15), vx: random.range(-10, 10) || 6, phase: random.next(), isGone: false });
    let targets = [];
    if (skin === 'hunt') {
      const count = ['hot', 'extreme'].includes(options.weatherKey) ? 2 : 3;
      for (let index = 0; index < count; index += 1) targets.push(spawnAnimal());
    } else if (skin === 'fish') {
      for (let index = 0; index < 4; index += 1) targets.push(spawnFish());
    } else {
      for (let index = 0; index < 12; index += 1) {
        const isDecoy = index % 3 === 2;
        targets.push({ x: 24 + (index % 6) * 50 + random.range(-8, 8), y: 96 + Math.floor(index / 6) * 36 + random.range(-6, 6), kind: isDecoy ? 'decoy' : (skin === 'fodder' ? 'grass' : random.pick(['fruit', 'root', 'grass', 'herb'])), isGone: false });
      }
    }
    const maxPicks = (skin === 'forage' || skin === 'fodder') ? 8 : settings.MAX_HITS;

    const getScale = () => { const rectangle = options.canvas.getBoundingClientRect(); return rectangle.width > 0 ? rectangle.width / width : 1; };
    /** Hit radius in logical canvas units, from CSS pixels, so tap size feels the same on every screen. */
    const hitRadiusLogical = () => Math.max(settings.MIN_TARGET_CSS_PIXELS / 2, settings.HIT_RADIUS_CSS_PIXELS * options.targetScale) / getScale();
    const nearRadiusLogical = () => (settings.NEAR_MISS_CSS_PIXELS * options.targetScale) / getScale();

    const getScore = () => Math.max(0, Math.min(1, (skin === 'hunt' ? score.hits : (skin === 'fish' ? score.hits : score.picks)) / maxPicks));

    function finish() {
      if (isFinished) return;
      isFinished = true;
      cancelAnimationFrame(animationHandle);
      options.canvas.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      options.onFinish(getScore());
    }

    function ringProgress(target) { return ((target.phase + (settings.DURATION_SECONDS - secondsLeft) / 3) % 1); }

    /** One tap or key press at a logical position. */
    function actAt(logicalX, logicalY) {
      if (isFinished) return;
      const radius = hitRadiusLogical();
      let nearest = null;
      let nearestDistance = Infinity;
      targets.forEach((target) => {
        if (target.isGone) return;
        const distance = Math.hypot(target.x - logicalX, target.y - logicalY);
        if (distance < nearestDistance) { nearest = target; nearestDistance = distance; }
      });
      if (skin === 'hunt') {
        if (score.attempts <= 0) return;
        if (nearest && nearestDistance <= radius) { score.attempts -= 1; score.hits += 1; message = 'Hit!'; flash = { x: nearest.x, y: nearest.y, left: 0.3 }; Object.assign(nearest, spawnAnimal()); }
        else if (nearest && nearestDistance <= nearRadiusLogical()) message = 'So close! (free shot)';
        else { score.attempts -= 1; message = 'Missed.'; }
        if (score.attempts <= 0) setTimeout(finish, 500);
      } else if (skin === 'fish') {
        if (nearest && nearestDistance <= radius) {
          const ring = ringProgress(nearest);
          if (ring >= 0.7 && ring <= 0.95) { score.hits += 1; message = 'Caught!'; Object.assign(nearest, spawnFish()); }
          else { score.scares += 1; message = 'You scared it.'; Object.assign(nearest, spawnFish()); }
        } else message = 'Nothing there.';
      } else if (nearest && nearestDistance <= radius) {
        nearest.isGone = true;
        if (nearest.kind === 'decoy') { score.picks = Math.max(0, score.picks - 1); message = 'A decoy! You lose a pick.'; }
        else { score.picks += 1; message = `Picked ${nearest.kind}.`; }
        if (targets.every((target) => target.isGone || target.kind === 'decoy')) setTimeout(finish, 300);
      } else message = 'Nothing there.';
    }

    function onPointerDown(event) {
      event.preventDefault();
      const rectangle = options.canvas.getBoundingClientRect();
      crosshair = { x: (event.clientX - rectangle.left) * (width / Math.max(1, rectangle.width)), y: (event.clientY - rectangle.top) * (height / Math.max(1, rectangle.height)), isVisible: true };
      actAt(crosshair.x, crosshair.y);
    }

    function onKeyDown(event) {
      if (event.target !== options.canvas && event.target !== document.body) return;
      const moves = { ArrowLeft: [-KEYBOARD_STEP, 0], ArrowRight: [KEYBOARD_STEP, 0], ArrowUp: [0, -KEYBOARD_STEP], ArrowDown: [0, KEYBOARD_STEP] };
      if (moves[event.key]) {
        event.preventDefault();
        crosshair = { x: Math.max(0, Math.min(width, crosshair.x + moves[event.key][0])), y: Math.max(0, Math.min(height, crosshair.y + moves[event.key][1])), isVisible: true };
      } else if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        crosshair = { ...crosshair, isVisible: true };
        actAt(crosshair.x, crosshair.y);
      }
    }

    /** Paints one target. Hit areas come from the logic above and do not depend on how a target looks. */
    function paintTarget(ctx, target) {
      const ui = UI();
      const palette = ui.PALETTE;
      if (skin === 'hunt') {
        ctx.globalAlpha = target.alpha;
        const facing = target.direction > 0 ? 1 : -1;
        const x = target.x - 8; const y = target.y - 6;
        ui.drawBlock(ctx, palette.camelDark, x + 2, y + 8, 2, 6);
        ui.drawBlock(ctx, palette.camelDark, x + 12, y + 8, 2, 6);
        ui.drawBlock(ctx, '#c9955a', x, y, 16, 8);
        ui.drawBlock(ctx, '#c9955a', facing > 0 ? x + 14 : x - 4, y - 4, 6, 6);
        const hornX = facing > 0 ? x + 18 : x - 2;
        ctx.strokeStyle = palette.ink; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(hornX, y - 4); ctx.lineTo(hornX + facing, y - 8); ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (skin === 'fish') {
        const ring = ringProgress(target);
        const isGoodMoment = ring >= 0.7 && ring <= 0.95;
        ui.drawEllipse(ctx, 'rgba(12, 32, 56, 0.7)', target.x, target.y, 9, 4, false);
        const tailX = target.x + (target.vx > 0 ? -11 : 11);
        ctx.beginPath(); ctx.moveTo(target.x + (target.vx > 0 ? -7 : 7), target.y); ctx.lineTo(tailX, target.y - 4); ctx.lineTo(tailX, target.y + 4); ctx.closePath();
        ctx.fillStyle = 'rgba(12, 32, 56, 0.7)'; ctx.fill();
        ctx.strokeStyle = isGoodMoment ? palette.gold : '#dcebf2';
        ctx.lineWidth = isGoodMoment ? 2 : 1;
        ctx.beginPath(); ctx.arc(target.x, target.y, 4 + (1 - ring) * 22, 0, Math.PI * 2); ctx.stroke();
      } else if (!target.isGone) {
        const x = target.x; const y = target.y;
        if (target.kind === 'fruit') { ui.drawDisc(ctx, palette.cinnabar, x, y + 1, 5.5); ui.fillRectangle(ctx, palette.leaf, x - 1, y - 6, 3, 3); }
        else if (target.kind === 'root') ui.drawEllipse(ctx, '#b07a45', x, y, 6, 4);
        else if (target.kind === 'grass') {
          [-3, 0, 3].forEach((offset) => { ctx.beginPath(); ctx.moveTo(x + offset, y + 5); ctx.lineTo(x + offset * 1.6, y - 6); ctx.strokeStyle = palette.ink; ctx.lineWidth = 4.4; ctx.stroke(); ctx.strokeStyle = '#f0dfa0'; ctx.lineWidth = 2.6; ctx.stroke(); });
        } else if (target.kind === 'herb') ui.drawDisc(ctx, palette.leaf, x, y, 6);
        else { ui.drawDisc(ctx, '#5b3a5e', x, y, 6); ui.fillRectangle(ctx, '#f1e6cf', x - 3, y - 3, 2, 2); ui.fillRectangle(ctx, '#f1e6cf', x + 2, y + 1, 2, 2); }
      }
    }

    function paint() {
      UI().withContext(options.canvas, (ctx) => {
        const ui = UI();
        const rect = ui.fillRectangle;
        const palette = ui.PALETTE;
        if (skin === 'fish') {
          rect(ctx, '#2f6c9a', 0, 0, width, height);
          rect(ctx, '#255a84', 0, 80, width, height - 80);
          for (let ripple = 0; ripple < 9; ripple += 1) rect(ctx, 'rgba(223, 235, 245, 0.5)', 10 + ripple * 36, 20 + (ripple % 3) * 44, 14, 1);
        } else {
          rect(ctx, '#a9c9d6', 0, 0, width, 70);
          ui.drawEllipse(ctx, palette.farMountain, 70, 72, 80, 18);
          ui.drawEllipse(ctx, palette.nearMountain, 250, 72, 90, 13);
          rect(ctx, (skin === 'forage' || skin === 'fodder') ? palette.groundGreen : '#9db864', 0, 70, width, height - 70);
          rect(ctx, palette.ink, 0, 70, width, 1);
        }
        targets.forEach((target) => paintTarget(ctx, target));
        if (flash) ui.drawDisc(ctx, '#fbf4e4', flash.x, flash.y, 10);
        if (isFoggy) rect(ctx, 'rgba(235, 230, 215, 0.5)', 0, 0, width, height);
        if (crosshair.isVisible) {
          rect(ctx, palette.ink, crosshair.x - 9, crosshair.y - 1, 18, 3); rect(ctx, palette.ink, crosshair.x - 1, crosshair.y - 9, 3, 18);
          rect(ctx, '#f8f0dd', crosshair.x - 7, crosshair.y, 14, 1); rect(ctx, '#f8f0dd', crosshair.x, crosshair.y - 7, 1, 14);
        }
      });
    }

    function step(timestamp) {
      animationHandle = requestAnimationFrame(step);
      if (isFinished) return;
      const delta = lastTimestamp === null ? 0 : Math.min(0.1, (timestamp - lastTimestamp) / 1000);
      lastTimestamp = timestamp;
      if (document.hidden) return;
      secondsLeft -= delta;
      if (flash) { flash.left -= delta; if (flash.left <= 0) flash = null; }
      targets.forEach((target) => {
        if (skin === 'hunt') {
          if (options.isStill) {
            target.relocateIn -= delta;
            target.alpha = Math.min(1, Math.abs(target.relocateIn) < 0.3 ? Math.abs(target.relocateIn) / 0.3 : 1);
            if (target.relocateIn <= -0.3) Object.assign(target, spawnAnimal());
          } else { target.x += target.direction * target.speed * delta; if (target.x < 12 || target.x > width - 12) target.direction *= -1; }
        } else if (skin === 'fish' && !options.isStill) {
          target.x += target.vx * delta;
          if (target.x < 14 || target.x > width - 14) target.vx *= -1;
        }
      });
      paint();
      const shown = skin === 'hunt' ? `Arrows ${score.attempts} · Hits ${score.hits}` : (skin === 'fish' ? `Caught ${score.hits}` : `Picked ${score.picks}`);
      options.onUpdate(`Time ${Math.max(0, Math.ceil(secondsLeft))} s · ${shown} · ${message}`);
      if (secondsLeft <= 0) finish();
    }

    options.canvas.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    options.onUpdate('Ready!');
    animationHandle = requestAnimationFrame(step);
    return { stop() { isFinished = true; cancelAnimationFrame(animationHandle); options.canvas.removeEventListener('pointerdown', onPointerDown); document.removeEventListener('keydown', onKeyDown); }, finishNow: finish };
  }

  // ===========================================================================
  // 2. APP COORDINATOR
  // ===========================================================================

  const AUTOSAVE_DEBOUNCE_MILLISECONDS = 400;
  const AUTOSAVE_EVERY_N_TRAVEL_DAYS = 3;
  const MAXIMUM_IMPORT_FILE_BYTES = 400000;
  const OPENING_STEPS = 12;
  const OPENING_SPEECH_INDEX = Object.freeze([0, 1, 2, 2, 2, 3, 4, 5, 6, 7, 8, 9]);

  let gameState = null;
  let randomSource = State.createRandomSource(1);
  let settings = Config.DEFAULT_SETTINGS;
  let provisionSession = null;
  let lastFrameTimestamp = null;
  let millisecondsIntoDay = 0;
  let autosaveTimer = null;
  let hasRecordedEnding = false;
  let isCaravanPanelOpen = false;
  let openingStep = 0;
  let openingDraft = null;
  let openingSeed = 1;

  const options = () => ({ saraiPolicy: settings.saraiDefault });

  function isReducedMotion() {
    const deviceWantsLess = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return settings.reducedMotion === 'on' || deviceWantsLess;
  }

  const createSeedFromClock = () => (Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0;

  // ---- saving ----------------------------------------------------------------

  function saveNow() {
    if (!gameState || gameState.phase === 'ended') return;
    if (State.saveGame(gameState, randomSource.getState())) UI().flashSaved();
  }

  function scheduleAutosave() {
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(saveNow, AUTOSAVE_DEBOUNCE_MILLISECONDS);
  }

  // ---- rendering -------------------------------------------------------------

  function showTitleScreen() {
    const loaded = State.loadGame();
    let saveSummary = null;
    let saveProblem = null;
    if (loaded.status === 'ok') {
      const edge = loaded.state.edgeId ? World.findEdge(loaded.state.edgeId) : null;
      const place = edge ? `on the road to ${World.findNode(edge.to).name}` : World.findNode(loaded.state.nodeId).name;
      saveSummary = `Day ${loaded.state.dayIndex} · ${place} · ${State.getLivingCount(loaded.state)}/${loaded.state.party.length} alive`;
    } else if (loaded.status === 'damaged') saveProblem = 'Your saved game could not be read. You can start a new journey, or import a backup from Settings.';
    else if (loaded.status === 'newer') saveProblem = 'This save is from a newer version of the game. Please reload to get the latest version.';
    UI().showTitle({ saveSummary, saveProblem, graves: State.loadGraves(), topScores: State.loadTopScores(), isStorageSupported: State.isStorageSupported(), hasLastSetup: State.loadLastSetup() !== null });
  }

  function renderRoadScreen() {
    const details = document.querySelector('[data-testid="caravan-details"]');
    if (details) isCaravanPanelOpen = details.hasAttribute('open');
    UI().showRoad(gameState, { isCaravanPanelOpen });
    const canvas = UI().getRoadCanvas();
    const screen = document.getElementById('screen');
    if (!screen.contains(canvas)) screen.querySelector('.travel-main').prepend(canvas);
    UI().renderRoadFrame(gameState, performance.now() / 1000, true);
  }

  function renderBackground() {
    if (gameState.phase === 'road' || (gameState.edgeId && gameState.phase !== 'stop')) renderRoadScreen();
    else UI().showStop(gameState);
  }

  function renderCurrent() {
    if (!gameState) return;
    if (gameState.phase === 'ended') { UI().closePending(); UI().showEnd(gameState); return; }
    renderBackground();
    if (gameState.pending) UI().showPending(gameState); else UI().closePending();
  }

  function handleJourneyEnded() {
    if (hasRecordedEnding || !gameState || gameState.phase !== 'ended') return;
    hasRecordedEnding = true;
    State.clearSavedGame();
    State.recordTopScore(gameState);
  }

  /** Adopts a state, handles endings and autosave, then redraws. */
  function commitState(nextState, opts) {
    const shouldRender = !opts || opts.shouldRender !== false;
    const shouldSave = !opts || opts.shouldSave !== false;
    const shouldAlert = (!opts || opts.shouldAlert !== false) && shouldRender;
    const previousState = gameState;
    gameState = nextState;
    if (gameState.phase === 'ended') handleJourneyEnded();
    else if (shouldSave) scheduleAutosave();
    if (shouldRender) renderCurrent();
    // Illness, weakness and deaths open a report. Selling, buying and treating never do.
    if (shouldAlert && previousState && gameState.phase !== 'ended') {
      const alerts = Engine.detectAlerts(previousState, gameState);
      if (alerts.length > 0) UI().openReport(alerts);
    }
  }

  // ---- the daily loop --------------------------------------------------------

  function advanceOneDay() {
    const before = gameState.dayIndex;
    const next = Engine.advanceDay(gameState, randomSource, options());
    const arrived = next.phase === 'stop';
    commitState(next);
    if (arrived) saveNow();
    else if (next.dayIndex !== before && next.dayIndex % AUTOSAVE_EVERY_N_TRAVEL_DAYS === 0) scheduleAutosave();
  }

  function onAnimationFrame(timestamp) {
    requestAnimationFrame(onAnimationFrame);
    const delta = lastFrameTimestamp === null ? 0 : Math.min(100, timestamp - lastFrameTimestamp);
    lastFrameTimestamp = timestamp;
    if (!gameState || gameState.phase !== 'road' || provisionSession) return;
    const isTicking = !gameState.isPaused && !gameState.pending && !document.hidden && !UI().hasOpenModal();
    const canvas = UI().getRoadCanvas();
    if (canvas.isConnected) UI().renderRoadFrame(gameState, timestamp / 1000, !isTicking || isReducedMotion());
    if (!isTicking) return;
    millisecondsIntoDay += delta;
    if (millisecondsIntoDay >= Config.TUNING.DAY_DURATION_MILLISECONDS) { millisecondsIntoDay = 0; advanceOneDay(); }
  }

  // ---- provisioning ----------------------------------------------------------

  let chosenProvisionSkin = null;

  function beginProvision(chosenSkin) {
    const pending = gameState.pending;
    if (!pending || pending.kind !== 'provision') return;
    const skin = chosenSkin === 'fodder' && pending.data.fodderRating > 0 ? 'fodder' : (pending.data.skin || 'fodder');
    chosenProvisionSkin = skin;
    UI().closePending();
    const mods = State.getModifiers(gameState);
    const timeFactor = (settings.hasAssists ? Config.PROVISION.ASSIST_TIME_FACTOR : 1) * (['rain', 'monsoon'].includes(gameState.weather.today) ? 0.8 : 1);
    const screen = UI().showProvisionScreen(skin);
    provisionSession = startProvisionSession({
      canvas: screen.canvas, skin, durationSeconds: Config.PROVISION.DURATION_SECONDS * timeFactor,
      targetScale: (settings.hasAssists ? Config.PROVISION.ASSIST_TARGET_FACTOR : 1) * State.getMod(mods, 'targetSizeMult', 1),
      isStill: isReducedMotion(), random: randomSource, weatherKey: gameState.weather.today,
      onUpdate: screen.update, onFinish: finishProvision,
    });
  }

  function finishProvision(score) {
    provisionSession = null;
    const before = gameState;
    const skin = chosenProvisionSkin;
    const next = Engine.resolveProvision(gameState, randomSource, score, options(), skin);
    commitState(next);
    if (skin === 'fodder') {
      const feedsGained = State.roundToTenth(next.supplies.feeds - before.supplies.feeds);
      UI().showNotice(feedsGained > 0 ? `Cutting fodder brought about ${feedsGained} feeds.` : 'The day brought little fodder.', feedsGained > 0 ? 'info' : 'warning');
      return;
    }
    const gained = State.roundToTenth(next.supplies.rations - before.supplies.rations);
    UI().showNotice(gained > 0 ? `The day's work brought about ${gained} rations.` : 'The day brought little food.', gained > 0 ? 'info' : 'warning');
  }

  // ---- opening ---------------------------------------------------------------

  function defaultDraft() {
    const last = State.loadLastSetup();
    const base = { archetypeId: 'persian', leaderName: '', cargoShare: 0.55, candidateIds: [], extraAnimals: [], rationPacks: 8, feedPacks: 8, startMonthIndex: 9, pace: 'steady', rationLevel: 'filling', scout: true, subplotId: 'book' };
    return last ? { ...base, ...last, extraAnimals: [], candidateIds: [] } : base;
  }

  function draftToSetup(draft) {
    const archetype = State.findArchetype(draft.archetypeId);
    return { ...draft, leaderName: draft.leaderName || archetype.names[0], worldSeed: openingSeed };
  }

  /** Three candidates from three different roles not yet taken. First run uses the curated offers. */
  function buildOffer(draft, step) {
    const takenRoles = draft.candidateIds.map((id) => State.findCandidate(id).role);
    const isFirstRun = State.loadLastSetup() === null;
    const curated = isFirstRun && step < 4 ? Content.FIRST_RUN_OFFERS[step - 2] : null;
    if (curated) {
      const offer = curated.map((id) => State.findCandidate(id)).filter((candidate) => !takenRoles.includes(candidate.role));
      if (offer.length === 3) return offer;
    }
    const roles = Object.keys(Config.ROLES).filter((role) => !takenRoles.includes(role));
    const source = State.createKeyedSource(openingSeed, `offer|${step}`);
    const shuffled = [...roles].sort(() => source.next() - 0.5).slice(0, 3);
    return shuffled.map((role) => source.pick(Content.CANDIDATES.filter((candidate) => candidate.role === role)));
  }

  function renderOpening() {
    const draft = openingDraft;
    const preview = State.createNewGame(draftToSetup(draft));
    UI().showOpening({
      step: openingStep, steps: OPENING_STEPS, speech: Content.DAULAT_BEG.beats[OPENING_SPEECH_INDEX[openingStep]],
      draft: { ...draft, leaderName: draft.leaderName || State.findArchetype(draft.archetypeId).names[0] }, preview,
      offer: openingStep >= 2 && openingStep <= 4 ? buildOffer(draft, openingStep) : [], canQuickStart: State.loadLastSetup() !== null,
    });
  }

  function startOpening() {
    openingSeed = createSeedFromClock();
    openingDraft = defaultDraft();
    openingStep = 0;
    renderOpening();
  }

  /** Builds a game from a draft, remembers the setup for quick start, and begins. */
  function beginJourneyFromDraft(draft) {
    const setup = draftToSetup(draft);
    // A quick or skipped opening may lack three recruits; fill the gaps with sensible defaults.
    const fallback = ['naseer', 'sher_dil', 'bibi_gulnar', 'hakim_jafar', 'munshi_kishan', 'gul_zaman'];
    const roles = new Set(setup.candidateIds.map((id) => State.findCandidate(id).role));
    fallback.forEach((id) => { const candidate = State.findCandidate(id); if (setup.candidateIds.length < 3 && !roles.has(candidate.role)) { setup.candidateIds.push(id); roles.add(candidate.role); } });
    State.saveLastSetup({ archetypeId: setup.archetypeId, leaderName: setup.leaderName, cargoShare: setup.cargoShare, candidateIds: setup.candidateIds, startMonthIndex: setup.startMonthIndex, subplotId: setup.subplotId, rationPacks: setup.rationPacks, feedPacks: setup.feedPacks });
    gameState = State.createNewGame(setup);
    randomSource = State.createRandomSource(setup.worldSeed ^ 0x9e3779b9);
    hasRecordedEnding = false;
    millisecondsIntoDay = 0;
    renderCurrent();
    saveNow();
  }

  // ---- loading and importing ------------------------------------------------

  function adoptLoadedState(loadedState, randomState) {
    let state = loadedState;
    if (!Events.isPendingValid(state.pending)) state = { ...state, pending: null, queue: [], dayStage: null };
    gameState = state;
    randomSource = State.createRandomSource(randomState);
    hasRecordedEnding = false;
    millisecondsIntoDay = 0;
    renderCurrent();
  }

  function downloadSaveFile() {
    saveNow();
    const text = State.exportSaveText();
    if (!text) { UI().showNotice('Nothing to export yet. Start a journey first.', 'warning'); return; }
    const address = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = address; anchor.download = 'karvanyan-save.json';
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(address), 1000);
  }

  function importSaveFile(inputElement) {
    const file = inputElement.files && inputElement.files[0];
    if (!file) return;
    if (file.size > MAXIMUM_IMPORT_FILE_BYTES) { UI().showNotice('That file is too large to be a save.', 'danger'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const result = State.importSaveText(String(reader.result));
      if (result.status !== 'ok') { UI().showNotice('That file is not a valid Kārvānyān save.', 'danger'); return; }
      UI().closeAllModals();
      adoptLoadedState(result.state, result.randomState);
      UI().showNotice(result.wasRepaired ? 'Save imported (some values were repaired).' : 'Save imported.', 'info');
    };
    reader.onerror = () => UI().showNotice('The file could not be read.', 'danger');
    reader.readAsText(file);
  }

  function applyAndPersistSettings() { State.saveSettings(settings); UI().applySettings(settings); }
  function reopenSettingsSheet() { UI().closeTopSheet(); UI().openSettings(settings, State.isStorageSupported()); }

  /** Runs a trade or service action and shows a notice if it was refused. */
  function applyTrade(result) {
    if (result.reason) { UI().showNotice(result.reason, 'warning'); return; }
    commitState(result.state, { shouldAlert: false });
  }

  // ---- actions ---------------------------------------------------------------

  const draftUpdate = (patch) => { openingDraft = { ...openingDraft, ...patch }; renderOpening(); };

  /** @type {Object<string, (argument:string|undefined, source:HTMLElement)=>void>} */
  const ACTIONS = {
    // menus
    goToTitle() { gameState = null; showTitleScreen(); },
    newJourney() {
      if (State.loadGame().status === 'ok') { UI().confirmAction({ title: 'Start a new journey?', message: 'Your saved run will be replaced.', confirmLabel: 'Replace my save', action: 'confirmNewJourney' }); return; }
      startOpening();
    },
    confirmNewJourney() { UI().closeAllModals(); startOpening(); },
    quickStart() { const last = State.loadLastSetup(); if (last) { openingSeed = createSeedFromClock(); beginJourneyFromDraft({ ...defaultDraft(), ...last }); } },
    continueGame() {
      const loaded = State.loadGame();
      if (loaded.status !== 'ok') { showTitleScreen(); return; }
      adoptLoadedState(loaded.state, loaded.randomState);
    },
    finishRun() {
      if (!gameState || gameState.phase !== 'ended') return;
      if (gameState.party.some((member) => !member.isAlive)) State.addGraves(gameState, UI().readEpitaph());
      gameState = null;
      showTitleScreen();
    },

    // opening
    openingArchetype(argument) { draftUpdate({ archetypeId: argument, leaderName: '' }); },
    openingNext() {
      if (openingStep === 0) { const typed = UI().readOpeningName(); openingDraft = { ...openingDraft, leaderName: State.sanitizeText(typed, Config.LIMITS.MAX_NAME_LENGTH, '') }; }
      openingStep = Math.min(OPENING_STEPS - 1, openingStep + 1);
      renderOpening();
    },
    openingBack() {
      if (openingStep >= 2 && openingStep <= 4 && openingDraft.candidateIds.length > openingStep - 2) openingDraft = { ...openingDraft, candidateIds: openingDraft.candidateIds.slice(0, openingStep - 2) };
      else if (openingStep === 5) openingDraft = { ...openingDraft, candidateIds: openingDraft.candidateIds.slice(0, 2) };
      openingStep = Math.max(0, openingStep - 1);
      renderOpening();
    },
    openingShare(argument) { draftUpdate({ cargoShare: Number(argument) }); },
    openingShareRange(argument) { draftUpdate({ cargoShare: Math.max(0.1, Math.min(0.9, Number(argument) / 100)) }); },
    openingCandidate(argument) { openingDraft = { ...openingDraft, candidateIds: [...openingDraft.candidateIds.slice(0, openingStep - 2), argument] }; openingStep += 1; renderOpening(); },
    openingAnimal(argument) { draftUpdate({ extraAnimals: [...openingDraft.extraAnimals, argument] }); },
    openingAnimalUndo() { draftUpdate({ extraAnimals: openingDraft.extraAnimals.slice(0, -1) }); },
    openingPacks(argument) { const [kind, delta] = argument.split(':'); const key = kind === 'rations' ? 'rationPacks' : 'feedPacks'; draftUpdate({ [key]: Math.max(0, Math.min(60, openingDraft[key] + Number(delta))) }); },
    openingMonth(argument) { draftUpdate({ startMonthIndex: Number(argument) }); },
    openingPace(argument) { draftUpdate({ pace: argument }); },
    openingRations(argument) { draftUpdate({ rationLevel: argument }); },
    openingScout(argument) { draftUpdate({ scout: argument === 'yes' }); },
    openingReason(argument) { draftUpdate({ subplotId: argument }); },
    openingSkip() {
      const last = State.loadLastSetup();
      beginJourneyFromDraft(last ? { ...defaultDraft(), ...last } : { ...openingDraft, candidateIds: openingDraft.candidateIds });
    },
    openingFinish() { beginJourneyFromDraft(openingDraft); },

    // sheets
    openCodex() { UI().openCodex(gameState); },
    openLog() { UI().openLog(gameState); },
    openSettings() { UI().openSettings(settings, State.isStorageSupported()); },
    closeSheet() { UI().closeTopSheet(); },
    setTextSize(argument) { settings = { ...settings, textSizePercent: Number(argument) }; applyAndPersistSettings(); reopenSettingsSheet(); },
    setTheme(argument) { settings = { ...settings, theme: argument }; applyAndPersistSettings(); reopenSettingsSheet(); },
    setSaraiDefault(argument) { settings = { ...settings, saraiDefault: argument }; applyAndPersistSettings(); reopenSettingsSheet(); },
    toggleReducedMotion() { settings = { ...settings, reducedMotion: settings.reducedMotion === 'on' ? 'auto' : 'on' }; applyAndPersistSettings(); reopenSettingsSheet(); },
    toggleScanlines() { settings = { ...settings, hasScanlines: !settings.hasScanlines }; applyAndPersistSettings(); reopenSettingsSheet(); },
    toggleAssists() { settings = { ...settings, hasAssists: !settings.hasAssists }; applyAndPersistSettings(); reopenSettingsSheet(); },
    exportSave() { downloadSaveFile(); },
    importSave(argument, source) { importSaveFile(source); },
    confirmResetSave() { UI().confirmAction({ title: 'Reset saved game?', message: 'This deletes your saved run on this device. Graves and scores are kept.', confirmLabel: 'Delete my save', action: 'resetSave' }); },
    resetSave() { State.clearSavedGame(); UI().closeAllModals(); if (!gameState) showTitleScreen(); },

    // HUD and tabs
    toggleHud() { UI().toggleHudExpanded(); renderCurrent(); },
    selectTab(argument) { UI().setStopTab(argument); UI().showStop(gameState); },
    dismissCoach() { commitState(State.setFlag(gameState, 'coachDismissed', true)); },

    // town
    buySupply(argument) { applyTrade(Engine.buySupply(gameState, argument)); },
    buyAnimal(argument) { applyTrade(Engine.buyAnimal(gameState, argument)); },
    sellLot(argument) { commitState(State.sellCargoLot(gameState, Number(argument)), { shouldAlert: false }); },
    sellSurplus(argument) { commitState(State.sellSurplus(gameState, argument, 10), { shouldAlert: false }); },
    sellAnimal(argument) { commitState(State.sellAnimal(gameState, argument), { shouldAlert: false }); },
    hire(argument) { const [type, tier, listingId] = argument.split(':'); applyTrade(Engine.hireService(gameState, type, tier, listingId || null)); },
    askCard(argument) {
      const card = State.findCard(argument);
      if (!card || card.nodeId !== gameState.nodeId || gameState.codex.includes(argument)) return;
      commitState(State.learnCard(gameState, argument));
      UI().showNotice(`Learned: ${card.title}`, 'info');
    },

    // caravan
    setPace(argument) { if (Config.PACES[argument]) commitState(State.patchState(gameState, { pace: argument })); },
    setRations(argument) { if (Config.RATIONS[argument]) commitState(State.patchState(gameState, { rationLevel: argument })); },
    treatMember(argument) {
      const treatment = State.treatMember(gameState, argument, randomSource);
      if (!treatment.wasPerformed) { UI().showNotice('No medicine, or nobody to treat.', 'warning'); return; }
      commitState(treatment.state, { shouldAlert: false });
      UI().showNotice(treatment.wasCured ? 'The medicine works.' : 'The medicine does not cure them this time.', treatment.wasCured ? 'info' : 'warning');
    },

    // moving and resting
    setOut() { commitState(Engine.beginLeg(gameState)); saveNow(); },
    restDay() { commitState(Engine.restDay(gameState, randomSource, options())); },
    setRestDays(argument) { UI().setRestDays(Number(argument)); renderCurrent(); },
    /** Rests up to N days in a city. Stops early if someone falls ill or dies, or an event needs a decision. */
    restMany(argument) {
      const days = Math.max(1, Math.min(10, Math.floor(Number(argument)) || 1));
      let state = gameState;
      for (let day = 0; day < days; day += 1) {
        const next = Engine.restDay(state, randomSource, options());
        if (next === state) break;
        const news = Engine.detectAlerts(state, next).filter((alert) => alert.tone !== 'info');
        state = next;
        if (state.pending || state.phase !== 'stop' || news.length > 0) break;
      }
      const alerts = Engine.detectAlerts(gameState, state);
      const daysRested = state.dayIndex - gameState.dayIndex;
      commitState(state, { shouldAlert: false });
      if (alerts.length > 0) UI().openReport(alerts, daysRested < days ? `You rested ${daysRested} of ${days} days.` : null);
      else if (state.phase === 'stop') UI().showNotice(`You rested ${daysRested} ${daysRested === 1 ? 'day' : 'days'}.`, 'info');
    },
    togglePause() { commitState(State.patchState(gameState, { isPaused: !gameState.isPaused })); },
    finishJourney() { commitState(Engine.finishAtDhaka(gameState)); },

    // provisioning
    startProvision(argument) { beginProvision(argument); },
    declineProvision() { UI().closePending(); commitState(Engine.resolveProvision(gameState, randomSource, null, options())); },

    // encounters
    chooseEncounter(argument) {
      const previousView = Events.getView(gameState);
      const outcome = Events.choose(gameState, argument, randomSource, options());
      if (!outcome) return;
      commitState(outcome.state, { shouldRender: false });
      if (outcome.state.phase === 'ended') { UI().closePending(); UI().showEnd(gameState); return; }
      UI().showPending(gameState, { resultMessage: outcome.message, referenceView: previousView });
    },
    encounterContinue() { UI().closePending(); renderCurrent(); },
  };

  /**
   * Single entry point for every button press. Unknown actions are ignored, and any error is shown
   * to the player instead of leaving the game silently frozen.
   */
  function dispatchAction(actionName, argument, sourceElement) {
    const handler = ACTIONS[actionName];
    if (!handler) return;
    if (actionName !== 'askCard' && actionName !== 'treatMember') UI().showNotice('');
    try {
      handler(argument, sourceElement);
    } catch (error) {
      console.error('Karvanyan action failed:', actionName, error);
      UI().showNotice('Something went wrong. Your last autosave is safe; reload the page to continue.', 'danger');
    }
  }

  // ---- boot ------------------------------------------------------------------

  function pauseAndSaveWhenHidden() {
    if (!document.hidden || !gameState) return;
    if (gameState.phase === 'road' && !gameState.isPaused && !gameState.pending) commitState(State.patchState(gameState, { isPaused: true }), { shouldSave: false });
    saveNow();
  }

  function boot() {
    const rootElement = document.getElementById('app');
    if (!rootElement) return;
    settings = State.loadSettings();
    UI().applySettings(settings);
    UI().initialize({ rootElement, onAction: dispatchAction });
    document.addEventListener('visibilitychange', pauseAndSaveWhenHidden);
    window.addEventListener('pagehide', saveNow);
    showTitleScreen();
    requestAnimationFrame(onAnimationFrame);
  }

  namespace.App = Object.freeze({ boot, dispatchAction });

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
})(window.Karvanyan);
