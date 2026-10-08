/**
 * ui.js — DOM manager.
 *
 * Responsibilities:
 *   - Build every screen from state using small component helpers (no innerHTML:
 *     all text goes through textContent, so names and epitaphs can never run as HTML).
 *   - One delegated click listener: elements carry data-action / data-argument,
 *     and UI reports them to game.js through the onAction callback. There is no
 *     per-button handler registry, so re-rendering can never leave a dead button.
 *   - Modal / bottom-sheet manager with a focus trap.
 *   - Canvas scene painters (road scene with weather, stop vignettes).
 *   - Every screen of the full game: title, opening, stop (Town, Caravan, Learn), road, minigame, end.
 *
 * The UI never changes game state. It only reads state and emits actions.
 */
(function (namespace) {
  'use strict';

  const Config = namespace.Config;
  const World = namespace.World;
  const Content = namespace.Content;
  const State = namespace.State;
  const Engine = namespace.Engine;
  const Events = namespace.Events;

  const FOCUSABLE_SELECTOR = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';
  const SAVED_INDICATOR_MILLISECONDS = 1500;

  /** @type {{rootElement:HTMLElement, screenElement:HTMLElement, modalRootElement:HTMLElement, onAction:Function}|null} */
  let context = null;
  let isHudExpanded = false;
  let activeStopTab = 'town';
  let travelCanvasElement = null;
  const modalStack = [];
  let encounterModal = null;
  let savedIndicatorTimer = null;

  // ---------------------------------------------------------------------------
  // Element helpers
  // ---------------------------------------------------------------------------

  /**
   * Creates an element. `properties` keys: className, text, dataset (object),
   * disabled (boolean), anything else becomes an attribute (use strings for aria-*).
   * @param {string} tagName
   * @param {Object} [properties]
   * @param {Array<Node|string|null|undefined|false>} [children]
   * @returns {HTMLElement}
   */
  function createElement(tagName, properties, children) {
    const element = document.createElement(tagName);
    const attributes = properties || {};
    Object.keys(attributes).forEach((key) => {
      const value = attributes[key];
      if (value === undefined || value === null || value === false) return;
      if (key === 'className') element.className = value;
      else if (key === 'text') element.textContent = value;
      else if (key === 'dataset') {
        Object.keys(value).forEach((dataKey) => {
          if (value[dataKey] !== undefined && value[dataKey] !== null) element.dataset[dataKey] = String(value[dataKey]);
        });
      } else if (key === 'disabled') element.disabled = true;
      else if (value === true) element.setAttribute(key, '');
      else element.setAttribute(key, String(value));
    });
    (children || []).forEach((child) => {
      if (child === null || child === undefined || child === false) return;
      element.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return element;
  }

  /**
   * @param {{label:string, action:string, argument?:string|number, testId?:string, variant?:'primary'|'secondary'|'quiet'|'danger', isDisabled?:boolean, className?:string, ariaLabel?:string, isPressed?:boolean}} options
   * @returns {HTMLButtonElement}
   */
  function createButton(options) {
    const variant = options.variant || 'secondary';
    const focusKey = options.testId || `${options.action}:${options.argument === undefined ? '' : options.argument}`;
    return createElement('button', {
      type: 'button',
      className: `button button--${variant} ${options.className || ''}`.trim(),
      text: options.label,
      disabled: Boolean(options.isDisabled),
      'aria-label': options.ariaLabel,
      'aria-pressed': options.isPressed === undefined ? undefined : String(options.isPressed),
      dataset: { action: options.action, argument: options.argument, testid: options.testId, focusKey },
    });
  }

  /** A labelled 0-100 bar. The number is always shown as text, never colour alone. */
  function createMeter(labelText, value, maximum, toneClass) {
    const percentage = Math.max(0, Math.min(100, (value / maximum) * 100));
    const fill = createElement('div', { className: `meter__fill ${toneClass || ''}`.trim() });
    fill.style.setProperty('width', `${percentage}%`);
    return createElement('div', { className: 'meter', role: 'img', 'aria-label': `${labelText}: ${Math.round(value)} of ${maximum}` }, [
      createElement('div', { className: 'meter__track', 'aria-hidden': 'true' }, [fill]),
      createElement('span', { className: 'meter__text', text: `${Math.round(value)}`, 'aria-hidden': 'true' }),
    ]);
  }

  /**
   * One ledger column: small label, big value, optional sub-line (e.g. days of supply left).
   * Text only, no emoji: emoji look different on every phone and cannot be styled.
   */
  function createChip(labelText, valueText, testId, subText, isSubWarning) {
    return createElement('div', { className: 'chip', dataset: { testid: testId } }, [
      createElement('span', { className: 'chip__label', text: labelText }),
      createElement('span', { className: 'chip__value', text: valueText }),
      subText ? createElement('span', { className: `chip__sub ${isSubWarning ? 'chip__sub--warning' : ''}`.trim(), text: subText }) : null,
    ]);
  }

  function createPanel(titleText, children, className) {
    return createElement('section', { className: `panel ${className || ''}`.trim() }, [
      titleText ? createElement('h2', { className: 'panel__title', text: titleText }) : null,
      ...children,
    ]);
  }

  function createParagraphs(texts) {
    return texts.map((text) => createElement('p', { className: 'paragraph', text }));
  }

  // ---------------------------------------------------------------------------
  // Initialisation, focus preservation, screen swapping
  // ---------------------------------------------------------------------------

  /**
   * @param {{rootElement:HTMLElement, onAction:(actionName:string, argument:string|undefined, sourceElement:HTMLElement)=>void}} options
   */
  function initialize(options) {
    const screenElement = options.rootElement.querySelector('#screen');
    const modalRootElement = document.getElementById('modal-root');
    if (!screenElement || !modalRootElement) throw new Error('Karvanyan: missing #screen or #modal-root in index.html');
    context = { rootElement: options.rootElement, screenElement, modalRootElement, onAction: options.onAction };

    document.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target.closest('[data-action]') : null;
      if (!target || target.disabled) return;
      context.onAction(target.dataset.action, target.dataset.argument, target);
    });
    document.addEventListener('change', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      if (target.dataset.changeAction) context.onAction(target.dataset.changeAction, target.value, target);
    });
    document.addEventListener('keydown', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (event.key === 'Enter' && target && target.dataset.enterAction) {
        event.preventDefault();
        context.onAction(target.dataset.enterAction, undefined, target);
      }
    });
  }

  /** Replaces the whole screen, keeping keyboard focus on the "same" control if it still exists. */
  function replaceScreen(children, screenName) {
    const previousFocusKey = document.activeElement && document.activeElement.dataset
      ? document.activeElement.dataset.focusKey : undefined;
    const hadFocusInScreen = context.screenElement.contains(document.activeElement);
    const preservedCanvas = travelCanvasElement && context.screenElement.contains(travelCanvasElement) ? travelCanvasElement : null;
    if (preservedCanvas) preservedCanvas.remove();

    context.screenElement.replaceChildren(...children);
    context.screenElement.dataset.screen = screenName;

    if (!hadFocusInScreen || !previousFocusKey || modalStack.length > 0) return;
    const candidates = context.screenElement.querySelectorAll('[data-focus-key]');
    for (const candidate of candidates) {
      if (candidate.dataset.focusKey === previousFocusKey && !candidate.disabled) { candidate.focus({ preventScroll: true }); return; }
    }
  }

  // ---------------------------------------------------------------------------
  // Modal and bottom-sheet manager (focus trap)
  // ---------------------------------------------------------------------------

  function setBackgroundInert(isInert) {
    const appElement = context.rootElement;
    if (isInert) appElement.setAttribute('aria-hidden', 'true'); else appElement.removeAttribute('aria-hidden');
    if ('inert' in appElement) appElement.inert = isInert;
    document.body.classList.toggle('has-modal', isInert);
  }

  /**
   * Opens a dialog. On phones CSS turns it into a bottom sheet.
   * @param {{title:string, icon?:string, isDismissible:boolean, build:(body:HTMLElement)=>void, testId?:string}} options
   * @returns {{setContent:(build:(body:HTMLElement)=>void, title?:string, icon?:string)=>void, close:()=>void}}
   */
  function openModal(options) {
    const previouslyFocused = document.activeElement;
    const titleId = `modal-title-${modalStack.length}`;
    const titleElement = createElement('h2', { className: 'modal__title', id: titleId, tabindex: '-1' });
    const bodyElement = createElement('div', { className: 'modal__body' });
    const dialogElement = createElement('div', {
      className: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, dataset: { testid: options.testId || 'modal' },
    }, [titleElement, bodyElement]);
    const backdropElement = createElement('div', { className: 'modal-backdrop' }, [dialogElement]);
    const entry = { backdropElement, dialogElement, previouslyFocused, isDismissible: options.isDismissible };

    function setContent(build, title, icon) {
      titleElement.textContent = title || options.title;
      bodyElement.replaceChildren();
      build(bodyElement);
      const firstControl = dialogElement.querySelector(FOCUSABLE_SELECTOR);
      (firstControl || titleElement).focus({ preventScroll: true });
      dialogElement.scrollTop = 0;
    }

    backdropElement.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && entry.isDismissible) {
        event.preventDefault();
        context.onAction('closeSheet', undefined, dialogElement);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialogElement.querySelectorAll(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) { event.preventDefault(); titleElement.focus(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const isOutside = !dialogElement.contains(document.activeElement);
      if (event.shiftKey && (document.activeElement === first || isOutside)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || isOutside)) { event.preventDefault(); first.focus(); }
    });
    if (options.isDismissible) {
      backdropElement.addEventListener('click', (event) => {
        if (event.target === backdropElement) context.onAction('closeSheet', undefined, backdropElement);
      });
    }

    if (modalStack.length === 0) setBackgroundInert(true);
    modalStack.push(entry);
    context.modalRootElement.appendChild(backdropElement);
    setContent(options.build, options.title, options.icon);

    return {
      setContent,
      close() {
        const position = modalStack.indexOf(entry);
        if (position === -1) return;
        modalStack.splice(position, 1);
        backdropElement.remove();
        if (modalStack.length === 0) setBackgroundInert(false);
        if (previouslyFocused && document.contains(previouslyFocused) && typeof previouslyFocused.focus === 'function') {
          previouslyFocused.focus({ preventScroll: true });
        }
      },
    };
  }

  /** Handles keep a reference so closeTopModal can close dismissible sheets. */
  const sheetHandles = [];

  /**
   * Opens a dismissible sheet (codex, settings, confirm...).
   * @param {{title:string, build:(body:HTMLElement)=>void, testId?:string}} options
   */
  function openSheet(options) {
    const handle = openModal({ ...options, isDismissible: true });
    sheetHandles.push(handle);
    return handle;
  }

  /** Closes the most recent dismissible sheet. Encounter dialogs are never closed this way. */
  function closeTopSheet() {
    const handle = sheetHandles.pop();
    if (handle) handle.close();
  }

  function closeAllModals() {
    while (sheetHandles.length > 0) sheetHandles.pop().close();
    if (encounterModal) { encounterModal.close(); encounterModal = null; }
  }

  function hasOpenModal() {
    return modalStack.length > 0;
  }

  // ---------------------------------------------------------------------------
  // Pending-choice dialog (storylets, tolls, crossings, night, overload, provisioning)
  // ---------------------------------------------------------------------------

  const TONE_VARIANT = Object.freeze({ safe: 'primary', risky: 'secondary', danger: 'danger' });

  /**
   * Shows the dialog for whatever the game is waiting on, or the result of the last choice.
   * @param {Object} state
   * @param {{resultMessage?:string, referenceView?:Object}} [options]
   */
  function showPending(state, options) {
    const view = (options && options.referenceView) || Events.getView(state);
    if (!view) return;
    const resultMessage = options && options.resultMessage;

    const build = (body) => {
      if (resultMessage) {
        body.appendChild(createElement('p', { className: 'paragraph paragraph--result', text: resultMessage }));
        body.appendChild(createButton({ label: 'Continue', action: 'encounterContinue', testId: 'modal-continue', variant: 'primary' }));
        return;
      }
      createParagraphs(view.paragraphs).forEach((paragraph) => body.appendChild(paragraph));
      if (view.kind === 'provision') {
        const skinText = { hunt: 'Hunt', fish: 'Fish', forage: 'Forage' }[state.pending.data.skin];
        body.appendChild(createElement('p', { className: 'paragraph', text: `Today's chance: ${skinText}. It costs nothing, takes about 20 seconds and cannot be skipped once started.` }));
        body.appendChild(createElement('div', { className: 'button-column' }, [
          createButton({ label: `Play: ${skinText}`, action: 'startProvision', testId: 'provision-play', variant: 'primary' }),
          createButton({ label: 'Just rest', action: 'declineProvision', testId: 'provision-decline' }),
        ]));
        return;
      }
      const list = createElement('div', { className: 'choice-list' });
      view.choices.forEach((choice, index) => {
        list.appendChild(createElement('div', { className: 'choice' }, [
          createButton({ label: choice.label, action: 'chooseEncounter', argument: choice.id, testId: `modal-choice-${index}`, variant: TONE_VARIANT[choice.tone] || 'secondary', isDisabled: Boolean(choice.reason), className: 'choice__button' }),
          createElement('span', { className: `choice__hint choice__hint--${choice.tone}`, text: choice.reason || choice.chips.join(' · ') }),
        ]));
      });
      body.appendChild(list);
    };

    if (encounterModal) encounterModal.setContent(build, view.title, view.icon);
    else encounterModal = openModal({ title: view.title, icon: view.icon, isDismissible: false, build, testId: 'modal' });
  }

  function closePending() {
    if (!encounterModal) return;
    encounterModal.close();
    encounterModal = null;
  }

  function confirmAction(options) {
    openSheet({
      title: options.title, testId: 'confirm',
      build(body) {
        body.appendChild(createElement('p', { className: 'paragraph', text: options.message }));
        body.appendChild(createElement('div', { className: 'button-row' }, [
          createButton({ label: options.confirmLabel, action: options.action, argument: options.argument, variant: 'danger' }),
          createButton({ label: 'Cancel', action: 'closeSheet', variant: 'quiet' }),
        ]));
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Canvas painters
  // ---------------------------------------------------------------------------

  /*
   * Miniature style: flat colour, a thin ink outline on every shape, raised horizons,
   * stylised rocks and trees. No gradients, no text inside the pictures.
   * Key names are shared with game.js (minigame), so change values here, never key names.
   */
  const PALETTE = Object.freeze({
    skyTop: '#2f5d8c', skyMiddle: '#6e9bbe', skyLow: '#e3c47a', skyGlow: '#f3dfa0',
    skyWinterTop: '#3a4f73', skyWinterLow: '#c9d3e0', skyRain: '#6c7c8f', skyFog: '#d8d3c4',
    farMountain: '#c9845a', nearMountain: '#9a5b3a', snow: '#f7f1e1',
    ground: '#d9b26c', groundGreen: '#7fa356', groundDark: '#a9803f', road: '#f0dfb0', roadDark: '#c7a765',
    camel: '#b88245', camelDark: '#6e4220', person: '#f1e6cf', water: '#2f6c9a', waterLight: '#bfddeb',
    stone: '#d8b98a', stoneDark: '#a67c4f', leaf: '#3f7d4a', gold: '#d9a441', ink: '#2a2118',
    cinnabar: '#a63a24', lapis: '#1f3a5f', malachite: '#3b8a5a',
  });
  const INK_LINE_WIDTH = 0.7;
  const TRAVELLER_COATS = Object.freeze([PALETTE.lapis, PALETTE.cinnabar, PALETTE.malachite]);
  const ANIMAL_COATS = Object.freeze({ camel: PALETTE.camel, horse: '#6b3f26', mule: '#8a6a4a', donkey: '#9c968a', ox: '#d9cba8' });

  function fillRectangle(ctx, color, x, y, width, height) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
  }

  const roundToHalf = (value) => Math.round(value * 2) / 2;

  /** A flat-colour rectangle with a thin ink outline: the basic stroke of the miniature style. */
  function drawBlock(ctx, color, x, y, width, height) {
    const left = roundToHalf(x);
    const top = roundToHalf(y);
    const blockWidth = roundToHalf(width);
    const blockHeight = roundToHalf(height);
    ctx.fillStyle = color;
    ctx.fillRect(left, top, blockWidth, blockHeight);
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = INK_LINE_WIDTH;
    ctx.strokeRect(left + 0.35, top + 0.35, Math.max(0, blockWidth - 0.7), Math.max(0, blockHeight - 0.7));
  }

  function drawEllipse(ctx, color, centreX, centreY, radiusX, radiusY, hasOutline) {
    ctx.beginPath();
    ctx.ellipse(centreX, centreY, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    if (hasOutline === false) return;
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = INK_LINE_WIDTH;
    ctx.stroke();
  }

  const drawDisc = (ctx, color, centreX, centreY, radius) => drawEllipse(ctx, color, centreX, centreY, radius, radius, true);

  /** Half-disc dome with a finial: the signature shape of a Persianate skyline. */
  function drawDome(ctx, color, centreX, baseY, radius) {
    ctx.beginPath();
    ctx.arc(centreX, baseY, radius, Math.PI, 0);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = INK_LINE_WIDTH;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(centreX, baseY - radius);
    ctx.lineTo(centreX, baseY - radius - 3);
    ctx.stroke();
  }

  /** Flat sky bands. Weather changes the palette, not the shape. */
  function paintSky(ctx, weatherKey) {
    const width = Config.CANVAS.LOGICAL_WIDTH;
    let bands = [PALETTE.skyTop, PALETTE.skyMiddle, PALETTE.skyLow, PALETTE.skyGlow];
    if (['cold', 'snow'].includes(weatherKey)) bands = [PALETTE.skyWinterTop, '#5b6f94', '#9fb0c8', PALETTE.skyWinterLow];
    else if (['rain', 'monsoon'].includes(weatherKey)) bands = ['#44546b', '#5a6b82', PALETTE.skyRain, '#9aa6b5'];
    else if (weatherKey === 'fog') bands = ['#bdbbb0', '#c9c6b8', '#d3d0c2', PALETTE.skyFog];
    else if (['hot', 'extreme', 'dust'].includes(weatherKey)) bands = ['#7a4f6b', '#c4694f', '#e8a15f', '#f6d88a'];
    bands.forEach((color, index) => fillRectangle(ctx, color, 0, index * 30, width, 32));
    if (!['rain', 'monsoon', 'fog'].includes(weatherKey)) {
      drawEllipse(ctx, 'rgba(248,240,221,0.92)', 52, 36, 20, 5);
      drawEllipse(ctx, 'rgba(248,240,221,0.92)', 196, 54, 24, 5);
    }
  }

  /** A raised, stylised mountain ridge: filled polygon, ink outline, optional snow cap. */
  function paintMountainRidge(ctx, color, baseY, amplitude, scrollOffset, wavelength, snowColor) {
    const width = Config.CANVAS.LOGICAL_WIDTH;
    const step = 4;
    const points = [];
    for (let x = -step; x <= width + step; x += step) {
      const position = (x + scrollOffset) / wavelength;
      points.push({ x, top: baseY - amplitude * (0.55 + 0.3 * Math.sin(position) + 0.15 * Math.sin(position * 2.7 + 1)) });
    }
    ctx.beginPath();
    ctx.moveTo(points[0].x, baseY + 2);
    points.forEach((point) => ctx.lineTo(point.x, point.top));
    ctx.lineTo(points[points.length - 1].x, baseY + 2);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    if (snowColor) {
      ctx.beginPath();
      points.forEach((point, index) => {
        const isHigh = baseY - point.top > amplitude * 0.8;
        if (isHigh && index > 0 && baseY - points[index - 1].top > amplitude * 0.8) { ctx.moveTo(points[index - 1].x, points[index - 1].top + 1.5); ctx.lineTo(point.x, point.top + 1.5); }
      });
      ctx.strokeStyle = snowColor;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.beginPath();
    points.forEach((point, index) => (index === 0 ? ctx.moveTo(point.x, point.top) : ctx.lineTo(point.x, point.top)));
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function paintAnimal(ctx, x, y, stepFrame, type) {
    const legShift = stepFrame ? 1 : -1;
    const isCamel = type === 'camel';
    const body = ANIMAL_COATS[type] || PALETTE.camel;
    drawBlock(ctx, PALETTE.camelDark, x + 2, y + 10, 2.5, 7 + legShift);
    drawBlock(ctx, PALETTE.camelDark, x + 5, y + 10, 2.5, 7 - legShift);
    drawBlock(ctx, PALETTE.camelDark, x + 12, y + 10, 2.5, 7 - legShift);
    drawBlock(ctx, PALETTE.camelDark, x + 15, y + 10, 2.5, 7 + legShift);
    drawBlock(ctx, body, x, y + 4, 18, 7);
    if (isCamel) { drawBlock(ctx, body, x + 5, y, 4, 5); drawBlock(ctx, body, x + 12, y + 1, 4, 4); }
    drawBlock(ctx, body, x + 17, y - (isCamel ? 4 : 1), 3, isCamel ? 9 : 6);
    drawBlock(ctx, body, x + 18, y - (isCamel ? 6 : 3), 5, 3);
    // Pack blanket: lapis cloth with a gold stripe, so every animal reads as a baggage animal.
    drawBlock(ctx, PALETTE.lapis, x + 3, y + 3.5, 12, 3.5);
    fillRectangle(ctx, PALETTE.gold, x + 4, y + 5, 10, 1);
  }

  function paintTraveller(ctx, x, y, stepFrame, isIll) {
    const coat = isIll ? '#9bb78b' : TRAVELLER_COATS[Math.floor(x / 20) % TRAVELLER_COATS.length];
    drawBlock(ctx, coat, x - 0.5, y + 3, 4.5, 7);
    drawDisc(ctx, isIll ? '#cfe0b8' : PALETTE.person, x + 1.75, y + 1.5, 2.4);
    drawBlock(ctx, PALETTE.camelDark, x, y + 10, 1.5, 2.5 + (stepFrame ? 1 : 0));
    drawBlock(ctx, PALETTE.camelDark, x + 2.5, y + 10, 1.5, 2.5 + (stepFrame ? 0 : 1));
  }

  /**
   * One frame of the road scene. Weather changes the sky, the snow or rain overlay and the haze.
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} state
   * @param {number} timeSeconds
   * @param {boolean} isStill  true when paused or reduced motion: nothing animates
   */
  function paintRoadScene(ctx, state, timeSeconds, isStill) {
    const width = Config.CANVAS.LOGICAL_WIDTH;
    const height = Config.CANVAS.LOGICAL_HEIGHT;
    const weatherKey = state.weather.today;
    const walkingTime = isStill ? 0 : timeSeconds;
    const scroll = (state.dayIndex * 18) + walkingTime * 14;
    const region = State.getRegionOfState(state);
    const isGreen = ['plainsN', 'doab', 'plainsE', 'delta'].includes(region.climate);
    const isCold = ['cold', 'snow'].includes(weatherKey);

    paintSky(ctx, weatherKey);
    if (!['rain', 'monsoon', 'fog'].includes(weatherKey)) drawDisc(ctx, isCold ? '#eef3fa' : PALETTE.skyGlow, 257, 47, 7);
    if (!isGreen || region.id === 'r11') {
      paintMountainRidge(ctx, PALETTE.farMountain, 105, region.climate === 'highland' ? 58 : 34, scroll * 0.15, 38, isCold || region.climate === 'highland' ? PALETTE.snow : null);
      paintMountainRidge(ctx, PALETTE.nearMountain, 122, region.climate === 'highland' ? 40 : 22, scroll * 0.35, 24, weatherKey === 'snow' ? PALETTE.snow : null);
    } else {
      fillRectangle(ctx, '#93b06b', 0, 112, width, 12);
      fillRectangle(ctx, PALETTE.ink, 0, 112, width, 1);
      for (let x = -(Math.round(scroll * 0.3) % 50); x < width; x += 50) {
        drawBlock(ctx, PALETTE.camelDark, x + 13.5, 112, 3, 10);
        drawEllipse(ctx, PALETTE.leaf, x + 15, 105, 8, 9);
      }
    }
    fillRectangle(ctx, isGreen ? PALETTE.groundGreen : PALETTE.ground, 0, 122, width, height - 122);
    fillRectangle(ctx, PALETTE.ink, 0, 122, width, 1);
    fillRectangle(ctx, PALETTE.groundDark, 0, 123, width, 2);
    fillRectangle(ctx, PALETTE.road, 0, 140, width, 22);
    fillRectangle(ctx, PALETTE.ink, 0, 140, width, 1);
    fillRectangle(ctx, PALETTE.ink, 0, 161, width, 1);
    for (let x = -(Math.round(scroll) % 24); x < width; x += 24) fillRectangle(ctx, PALETTE.roadDark, x, 151, 12, 2);

    const stepFrame = Math.floor(walkingTime * 4) % 2 === 0;
    state.animals.slice(0, 6).forEach((animal, index) => paintAnimal(ctx, 16 + index * 30, 128 + (index % 2) * 4, stepFrame, animal.type));
    State.getLivingIndices(state).forEach((memberIndex, position) => paintTraveller(ctx, 26 + position * 20, 144 + (position % 2) * 3, stepFrame, Boolean(state.party[memberIndex].illness)));

    if (isCold && !isStill) for (let flake = 0; flake < 36; flake += 1) drawDisc(ctx, PALETTE.snow, (flake * 37 + timeSeconds * 20) % width, (flake * 53 + timeSeconds * 45) % height, 1);
    if (['rain', 'monsoon'].includes(weatherKey)) for (let drop = 0; drop < (weatherKey === 'monsoon' ? 60 : 30); drop += 1) fillRectangle(ctx, 'rgba(223,235,245,0.8)', (drop * 29 + (isStill ? 0 : timeSeconds * 60)) % width, (drop * 47 + (isStill ? 0 : timeSeconds * 120)) % height, 1, 5);
    if (weatherKey === 'fog') fillRectangle(ctx, 'rgba(235,230,215,0.55)', 0, 70, width, 90);
    if (['hot', 'extreme'].includes(weatherKey)) for (let line = 0; line < 4; line += 1) fillRectangle(ctx, 'rgba(255,236,170,0.3)', 0, 112 + line * 4 + (isStill ? 0 : Math.round(Math.sin(timeSeconds * 2 + line))), width, 1);
    if (weatherKey === 'dust') fillRectangle(ctx, 'rgba(214,170,110,0.35)', 0, 90, width, 80);
  }

  function paintCrenellations(ctx, x, y, wallWidth) {
    for (let left = x; left + 8 <= x + wallWidth; left += 12) drawBlock(ctx, PALETTE.stone, left, y, 8, 8);
  }

  /** A fort: crenellated wall and an arched gate. */
  function paintFort(ctx, x, y, wallWidth, wallHeight) {
    paintCrenellations(ctx, x, y - 8, wallWidth);
    drawBlock(ctx, PALETTE.stoneDark, x, y, wallWidth, wallHeight);
    const gateX = x + wallWidth / 2 - 8;
    ctx.fillStyle = PALETTE.ink;
    ctx.fillRect(gateX, y + wallHeight - 24, 16, 24);
    ctx.beginPath();
    ctx.arc(gateX + 8, y + wallHeight - 24, 8, Math.PI, 0);
    ctx.fill();
  }

  /** Stop pictures: a handful of shapes chosen per stop. No lettering: the name is in the page heading. */
  function paintStopScene(ctx, nodeId) {
    const width = Config.CANVAS.LOGICAL_WIDTH;
    const height = Config.CANVAS.LOGICAL_HEIGHT;
    const node = World.findNode(nodeId);
    const region = World.getRegion(node.region);
    const isGreen = ['plainsN', 'doab', 'plainsE', 'delta'].includes(region.climate);
    paintSky(ctx, 'clear');
    if (!isGreen) paintMountainRidge(ctx, PALETTE.farMountain, 110, 50, 20, 40, region.climate === 'highland' ? PALETTE.snow : null);
    fillRectangle(ctx, isGreen ? PALETTE.groundGreen : PALETTE.ground, 0, 118, width, height - 118);
    fillRectangle(ctx, PALETTE.ink, 0, 118, width, 1);
    fillRectangle(ctx, PALETTE.groundDark, 0, 119, width, 2);
    const riverNodes = ['attock', 'jhelum', 'allahabad', 'varanasi', 'patna', 'munger', 'bhagalpur', 'dhaka', 'agra', 'mathura', 'makhsusabad'];
    if (riverNodes.includes(nodeId)) {
      fillRectangle(ctx, PALETTE.water, 0, 140, width, 40);
      fillRectangle(ctx, PALETTE.ink, 0, 140, width, 1);
      for (let x = 0; x < width; x += 18) fillRectangle(ctx, PALETTE.waterLight, x, 150 + (x % 3) * 8, 10, 2);
    }
    if (nodeId === 'kabul') {
      paintFort(ctx, 150, 70, 120, 50);
      drawBlock(ctx, PALETTE.stone, 160, 44, 16, 26);
      drawDome(ctx, PALETTE.lapis, 168, 44, 9);
    } else if (nodeId === 'khyber') {
      drawBlock(ctx, PALETTE.stoneDark, 0, 20, 110, 110);
      drawBlock(ctx, PALETTE.stoneDark, 210, 10, 110, 120);
      drawBlock(ctx, PALETTE.stone, 100, 40, 12, 90);
      drawBlock(ctx, PALETTE.stone, 208, 30, 12, 100);
      drawBlock(ctx, PALETTE.stone, 40, 6, 16, 14);
    } else if (nodeId === 'jalalabad') {
      for (let index = 0; index < 5; index += 1) {
        const x = 40 + index * 58;
        drawBlock(ctx, PALETTE.camelDark, x, 84, 4, 38);
        drawEllipse(ctx, PALETTE.leaf, x + 2, 76, 16, 6);
        drawEllipse(ctx, PALETTE.leaf, x + 2, 69, 10, 5);
      }
    } else if (['rohtas', 'attock', 'munger', 'agra', 'delhi'].includes(nodeId)) {
      paintFort(ctx, 90, 66, 140, 62);
      if (nodeId === 'agra') { drawBlock(ctx, PALETTE.stone, 232, 40, 18, 28); drawDome(ctx, PALETTE.cinnabar, 241, 40, 9); }
    } else {
      const towers = node.tier === 'great' ? 5 : (node.tier === 'large' ? 4 : (node.tier === 'medium' ? 3 : 2));
      drawBlock(ctx, PALETTE.stoneDark, 40, 92, 240, 28);
      // A domed hall in the middle of the skyline; bigger in bigger towns.
      const hallWidth = 20 + towers * 6;
      drawBlock(ctx, PALETTE.stone, 160 - hallWidth / 2, 70, hallWidth, 50);
      drawDome(ctx, PALETTE.lapis, 160, 70, hallWidth / 2);
      for (let index = 0; index < towers; index += 1) {
        const x = 60 + index * (200 / towers);
        const top = 56 - (index % 2) * 10;
        drawBlock(ctx, PALETTE.stone, x, top, 8, 64);
        drawDome(ctx, PALETTE.gold, x + 4, top, 6);
      }
    }
  }

  function createSceneCanvas(testId, description) {
    const scale = Config.CANVAS.RENDER_SCALE || 1;
    return createElement('canvas', { className: 'scene-canvas', width: Config.CANVAS.LOGICAL_WIDTH * scale, height: Config.CANVAS.LOGICAL_HEIGHT * scale, role: 'img', 'aria-label': description, dataset: { testid: testId } });
  }

  /** Paints in logical 320x180 units; the canvas holds RENDER_SCALE times more pixels so lines stay crisp. */
  function withContext(canvas, paint) {
    const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
    if (!ctx) return;
    const scale = Config.CANVAS.RENDER_SCALE || 1;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.imageSmoothingEnabled = true;
    paint(ctx);
  }

  function getRoadCanvas() {
    if (!travelCanvasElement) travelCanvasElement = createSceneCanvas('travel-canvas', 'Animated view of your caravan on the road');
    return travelCanvasElement;
  }

  const renderRoadFrame = (state, timeSeconds, isStill) => withContext(travelCanvasElement, (ctx) => paintRoadScene(ctx, state, timeSeconds, isStill));

  // ---------------------------------------------------------------------------
  // Shared screen parts
  // ---------------------------------------------------------------------------

  const label = (value) => `${value[0].toUpperCase()}${value.slice(1)}`;
  const weatherText = (key) => Config.WEATHER[key].label;
  const rangeText = (range) => (range[0] === range[1] ? String(range[0]) : `${range[0]}-${range[1]}`);

  function createHud(state) {
    const capacity = State.getCapacity(state);
    const load = State.getLoad(state);
    // Days of supply left come from the same function as the action-bar forecast, so they never disagree.
    const edge = State.getEdge(state) || World.getOutgoingEdges(state.nodeId)[0] || null;
    const forecast = edge ? Engine.computeSupplyForecast(state, edge) : null;
    const essentials = createElement('div', { className: 'hud__row' }, [
      createChip('Rupees', String(Math.floor(state.money)), 'hud-money'),
      createChip('Rations', String(Math.floor(state.supplies.rations)), 'hud-food', forecast ? `\u2248 ${forecast.rationDays} d` : null, forecast ? forecast.rationDays < forecast.legDays : false),
      createChip('Feeds', String(Math.floor(state.supplies.feeds)), 'hud-fodder', forecast ? `\u2248 ${forecast.feedDays} d` : null, forecast ? forecast.feedDays < forecast.legDays : false),
      createChip('Party', `${State.getLivingCount(state)}/${state.party.length}`, 'hud-party'),
    ]);
    const children = [essentials];
    if (isHudExpanded) {
      children.push(createElement('div', { className: 'hud__row hud__row--extra' }, [
        createChip('Cargo', String(state.cargo ? state.cargo.units : 0), 'hud-goods'), createChip('Medicine', String(state.supplies.medicine), 'hud-med'),
        createChip('Animals', String(state.animals.length), 'hud-animals'), createChip('Load', `${load}/${capacity}`, 'hud-load'),
        createChip('Hired', String(state.hired.length), 'hud-guards'), createChip('Day', String(state.dayIndex), 'hud-day'),
      ]));
    }
    children.push(createElement('div', { className: 'hud__meta' }, [
      createElement('p', { className: `hud__date ${load > capacity ? 'hud__date--warning' : ''}`.trim(), dataset: { testid: 'hud-date' }, text: `${State.formatDate(state)} \u00b7 ${State.getHijriLabel(state)} \u00b7 ${weatherText(state.weather.today)}${load > capacity ? ' \u00b7 OVERLOADED' : ''}` }),
      createButton({ label: isHudExpanded ? 'Fewer details' : 'More details', action: 'toggleHud', testId: 'hud-expand', variant: 'quiet', className: 'hud__toggle', ariaLabel: isHudExpanded ? 'Show fewer supplies' : 'Show more supplies', isPressed: isHudExpanded }),
    ]));
    return createElement('header', { className: 'hud' }, children);
  }

  function createStepper(legend, options, selectedId, action, testIdPrefix) {
    const buttons = Object.values(options).map((option) => createButton({ label: option.label, action, argument: option.id, testId: `${testIdPrefix}-${option.id}`, variant: option.id === selectedId ? 'primary' : 'secondary', isPressed: option.id === selectedId }));
    return createElement('fieldset', { className: 'stepper' }, [createElement('legend', { className: 'stepper__legend', text: legend }), createElement('div', { className: 'stepper__buttons' }, buttons), createElement('p', { className: 'stepper__help', text: options[selectedId].help })]);
  }

  function createPartyList(state, canTreat) {
    const list = createElement('ul', { className: 'party-list' });
    state.party.forEach((member, index) => {
      const status = !member.isAlive ? `Died · ${member.cause}` : (member.illness ? Config.ILLNESSES[member.illness].label : (member.hp < Config.TUNING.WEAK_HP ? 'Weak' : 'Well'));
      const roleText = member.role ? Config.ROLES[member.role].label : 'Leader';
      const row = createElement('li', { className: `party-member ${member.isAlive ? '' : 'party-member--dead'}`.trim() }, [
        createElement('div', { className: 'party-member__header' }, [
          createElement('span', { className: 'party-member__name', text: `${member.name} (${roleText})` }),
          createElement('span', { className: 'party-member__status', text: status }),
        ]),
        member.isAlive ? createMeter(`${member.name} health`, member.hp, 100, member.hp < Config.TUNING.WEAK_HP ? 'meter__fill--danger' : '') : null,
      ]);
      if (member.isAlive && member.illness && canTreat) {
        row.appendChild(createButton({ label: `Treat (${state.supplies.medicine} medicine)`, action: 'treatMember', argument: member.id, testId: `treat-${index}`, variant: 'primary', isDisabled: state.supplies.medicine < 1, className: 'party-member__treat' }));
      }
      list.appendChild(row);
    });
    return list;
  }

  function createForecastLine(state, edge) {
    const forecast = Engine.computeSupplyForecast(state, edge);
    const warning = forecast.rationDays < forecast.legDays || forecast.feedDays < forecast.legDays;
    return { warning, text: `Rations ${forecast.rationDays} d · Feeds ${forecast.feedDays} d · ${forecast.destination} ≈ ${forecast.legDays} d` };
  }

  function createForecastWeather(state) {
    const entries = Engine.getForecast(state);
    if (entries.length === 0) return 'No forecast.';
    return entries.map((entry) => `+${entry.aheadDays}d ${Config.WEATHER[entry.shown].label} (${Math.round(entry.accuracy * 100)}%)`).join(' · ');
  }

  // ---------------------------------------------------------------------------
  // Title
  // ---------------------------------------------------------------------------

  /** @param {{saveSummary:string|null, saveProblem:string|null, graves:Array, topScores:Array, isStorageSupported:boolean, hasLastSetup:boolean}} view */
  function showTitle(view) {
    closeAllModals();
    const banner = createSceneCanvas('title-canvas', 'Illustration of Kabul at dusk');
    withContext(banner, (ctx) => paintStopScene(ctx, 'kabul'));
    const children = [
      createElement('header', { className: 'title-block' }, [
        createElement('h1', { className: 'title-block__name', text: 'Kārvānyān of Sadak\u2011e\u2011Azam' }),
        createElement('p', { className: 'title-block__subtitle', text: 'The Long Road East' }),
        createElement('p', { className: 'title-block__tagline', text: 'Lead a merchant caravan from Kabul to Dhaka, 1665.' }),
      ]), banner,
    ];
    if (!view.isStorageSupported) children.push(createElement('p', { className: 'banner banner--warning', role: 'status', dataset: { testid: 'save-banner' }, text: 'Saving is not available in this browser mode. Your run will be lost if you close the tab.' }));
    if (view.saveProblem) children.push(createElement('p', { className: 'banner banner--danger', role: 'alert', text: view.saveProblem }));
    const menu = createElement('nav', { className: 'menu', 'aria-label': 'Main menu' });
    if (view.saveSummary) { menu.appendChild(createButton({ label: 'Continue', action: 'continueGame', testId: 'title-continue', variant: 'primary', className: 'menu__continue' })); menu.appendChild(createElement('p', { className: 'menu__summary', text: view.saveSummary })); }
    menu.appendChild(createButton({ label: 'New journey', action: 'newJourney', testId: 'title-new', variant: view.saveSummary ? 'secondary' : 'primary' }));
    if (view.hasLastSetup) menu.appendChild(createButton({ label: 'Quick start (repeat last party)', action: 'quickStart', testId: 'title-quick' }));
    menu.appendChild(createElement('div', { className: 'button-row' }, [createButton({ label: 'Codex', action: 'openCodex', testId: 'btn-codex', variant: 'quiet' }), createButton({ label: 'Settings', action: 'openSettings', testId: 'btn-settings', variant: 'quiet' })]));
    children.push(menu);
    if (view.graves.length > 0) children.push(createPanel('Roadside graves', [createElement('ul', { className: 'record-list' }, view.graves.map((grave) => createElement('li', {}, [createElement('strong', { text: grave.name }), ` — ${grave.role}, ${grave.cause}${grave.place ? `, ${grave.place}` : ''}. `, grave.epitaph ? createElement('em', { text: `"${grave.epitaph}"` }) : null])))]));
    if (view.topScores.length > 0) children.push(createPanel('Top ten (this device)', [createElement('ol', { className: 'record-list' }, view.topScores.map((entry) => createElement('li', { text: `${entry.name} (${entry.archetype}) · ${entry.score} · ${entry.resultLabel}` })))]));
    children.push(createElement('footer', { className: 'footer', text: `Version ${Config.GAME_VERSION}` }));
    replaceScreen(children, 'title');
  }

  // ---------------------------------------------------------------------------
  // Opening (GDD 9.2): Daulat Beg walks the player through setup, one choice per beat
  // ---------------------------------------------------------------------------

  /**
   * @param {{step:number, steps:number, speech:string, draft:Object, preview:Object, offer:Object[], canQuickStart:boolean}} view
   */
  function showOpening(view) {
    closeAllModals();
    const { step, draft, preview } = view;
    const archetype = State.findArchetype(draft.archetypeId);
    const body = [];
    const nextButton = (labelText, action) => createButton({ label: labelText || 'Next', action: action || 'openingNext', testId: 'opening-next', variant: 'primary' });

    if (step === 0) {
      body.push(createPanel('Who are you?', [createElement('div', { className: 'button-column' }, Config.ARCHETYPES.map((item) => createButton({ label: `${item.label} · ${item.difficultyLabel}`, action: 'openingArchetype', argument: item.id, testId: `merchant-${item.id}`, variant: item.id === draft.archetypeId ? 'primary' : 'secondary', isPressed: item.id === draft.archetypeId })))]));
      body.push(createPanel(archetype.label, [
        createElement('p', { className: 'paragraph', text: Content.DAULAT_BEG.reasons[archetype.id] }),
        createElement('p', { className: 'paragraph', text: `Home: ${archetype.homeText} Strength: ${archetype.expertText} Weakness: ${archetype.weaknessText}` }),
        createElement('p', { className: 'paragraph', text: `Cargo: ${Config.CARGO[archetype.cargoId].label}. Capital: ${archetype.capital} rupees. Animals: ${Object.keys(archetype.animals).map((type) => `${archetype.animals[type]} ${type}`).join(', ')}.` }),
      ]));
      body.push(createElement('label', { className: 'field' }, [createElement('span', { className: 'field__label', text: 'Name the leader' }), createElement('input', { className: 'field__input', type: 'text', id: 'opening-name', maxlength: String(Config.LIMITS.MAX_NAME_LENGTH), value: draft.leaderName || archetype.names[0], autocomplete: 'off', dataset: { testid: 'opening-name', enterAction: 'openingNext' } })]));
      body.push(nextButton());
    } else if (step === 1) {
      const cargo = preview.cargo;
      body.push(createElement('div', { className: 'button-row' }, Config.CARGO_PRESETS.map((preset) => createButton({ label: `${preset.label} (${Math.round(preset.share * 100)}%)`, action: 'openingShare', argument: preset.share, testId: `preset-${preset.id}`, variant: Math.abs(draft.cargoShare - preset.share) < 0.01 ? 'primary' : 'secondary' }))));
      body.push(createElement('label', { className: 'field' }, [createElement('span', { className: 'field__label', text: `Share of capital in cargo: ${Math.round(draft.cargoShare * 100)}%` }), createElement('input', { type: 'range', min: '10', max: '90', step: '5', value: String(Math.round(draft.cargoShare * 100)), id: 'opening-share', className: 'field__range', dataset: { changeAction: 'openingShareRange', testid: 'opening-share' } })]));
      body.push(createPanel('Result', [createElement('p', { className: 'paragraph', text: `${cargo.units} ${Config.CARGO[cargo.id].label.toLowerCase()} (${State.roundToTenth(cargo.units * Config.CARGO[cargo.id].lu)} load units) and ${Math.round(preview.money)} rupees in the purse. Cargo is capped by free capacity; unspent cargo money returns to the purse.` })]));
      body.push(nextButton());
    } else if (step >= 2 && step <= 4) {
      body.push(createElement('div', { className: 'choice-list' }, view.offer.map((candidate) => createElement('div', { className: 'choice' }, [
        createButton({ label: `${candidate.name} · ${Config.ROLES[candidate.role].label}`, action: 'openingCandidate', argument: candidate.id, testId: `candidate-${candidate.id}`, variant: 'primary', className: 'choice__button' }),
        createElement('span', { className: 'choice__hint', text: `+ ${candidate.strengthText} − ${candidate.flawText} "${candidate.line}"` }),
      ]))));
      body.push(createElement('p', { className: 'footnote', text: `Picked so far: ${draft.candidateIds.map((id) => State.findCandidate(id).name).join(', ') || 'nobody'}. Gaps are permanent.` }));
    } else if (step === 5) {
      body.push(createPanel('Your animals', [createElement('p', { className: 'paragraph', text: `${preview.animals.map((animal) => Config.ANIMALS[animal.type].label).join(', ')}. Capacity ${State.getCapacity(preview)} load units. Purse ${Math.round(preview.money)} rupees.` }),
        createElement('div', { className: 'button-column' }, ['donkey', 'ox', 'mule', 'camel', 'horse'].map((type) => createButton({ label: `Buy a ${type} · ${Config.ANIMALS[type].price} rupees · carries ${Config.ANIMALS[type].capacity}`, action: 'openingAnimal', argument: type, testId: `buy-${type}`, isDisabled: preview.money < Config.ANIMALS[type].price }))),
        createButton({ label: 'Undo last animal', action: 'openingAnimalUndo', variant: 'quiet', isDisabled: draft.extraAnimals.length === 0 })]));
      body.push(nextButton());
    } else if (step === 6) {
      const edge = World.getOutgoingEdges('kabul')[0];
      const forecast = Engine.computeSupplyForecast(preview, edge);
      body.push(createPanel('Your larder', [
        createElement('p', { className: `forecast ${forecast.rationDays < forecast.legDays ? 'forecast--warning' : ''}`.trim(), dataset: { testid: 'forecast' }, text: `Rations ${forecast.rationDays} d · Feeds ${forecast.feedDays} d · Jalalabad ≈ ${forecast.legDays} d` }),
        createMeter('Load', State.getLoad(preview), State.getCapacity(preview) || 1, ''),
        createElement('p', { className: 'paragraph', text: `Load ${State.getLoad(preview)} of ${State.getCapacity(preview)}. Purse ${Math.round(preview.money)} rupees.` }),
        createElement('div', { className: 'button-row' }, [createButton({ label: `Rations: ${draft.rationPacks} packs −`, action: 'openingPacks', argument: 'rations:-1', isDisabled: draft.rationPacks <= 0 }), createButton({ label: 'Rations +', action: 'openingPacks', argument: 'rations:1', testId: 'opening-rations-plus' })]),
        createElement('div', { className: 'button-row' }, [createButton({ label: `Feeds: ${draft.feedPacks} packs −`, action: 'openingPacks', argument: 'feeds:-1', isDisabled: draft.feedPacks <= 0 }), createButton({ label: 'Feeds +', action: 'openingPacks', argument: 'feeds:1', testId: 'opening-feeds-plus' })]),
      ]));
      body.push(nextButton());
    } else if (step === 7) {
      body.push(createElement('div', { className: 'choice-list' }, Config.CALENDAR.START_OPTIONS.map((option) => createElement('div', { className: 'choice' }, [createButton({ label: option.label, action: 'openingMonth', argument: option.monthIndex, testId: `setup-month-${option.monthIndex}`, variant: draft.startMonthIndex === option.monthIndex ? 'primary' : 'secondary', isPressed: draft.startMonthIndex === option.monthIndex, className: 'choice__button' }), createElement('span', { className: 'choice__hint', text: option.consequence })]))));
      body.push(nextButton());
    } else if (step === 8) {
      body.push(createPanel('Pace and rations', [createStepper('Pace', Config.PACES, draft.pace, 'openingPace', 'pace'), createStepper('Rations', Config.RATIONS, draft.rationLevel, 'openingRations', 'ration')]));
      body.push(nextButton());
    } else if (step === 9) {
      body.push(createElement('div', { className: 'button-column' }, [createButton({ label: 'Accept the scout (patron pays)', action: 'openingScout', argument: 'yes', testId: 'opening-scout-yes', variant: draft.scout ? 'primary' : 'secondary' }), createButton({ label: 'Decline', action: 'openingScout', argument: 'no', testId: 'opening-scout-no', variant: draft.scout ? 'secondary' : 'primary' })]));
      body.push(nextButton());
    } else if (step === 10) {
      body.push(createElement('div', { className: 'button-column' }, Content.DAULAT_BEG.privateReasons.map((reason) => createButton({ label: reason.label, action: 'openingReason', argument: reason.id, testId: `reason-${reason.id}`, variant: draft.subplotId === reason.id ? 'primary' : 'secondary', isPressed: draft.subplotId === reason.id }))));
      body.push(nextButton());
    } else {
      body.push(createPanel('Ready', [createElement('p', { className: 'paragraph', text: `${draft.leaderName} sets out from Kabul with ${preview.cargo.units} lots of ${Config.CARGO[preview.cargo.id].label.toLowerCase()}, ${preview.animals.length} animals and ${Math.round(preview.money)} rupees.` })]));
      body.push(createButton({ label: 'Set out', action: 'openingFinish', testId: 'setup-begin', variant: 'primary' }));
    }

    const nav = createElement('div', { className: 'button-row' }, [
      step > 0 ? createButton({ label: 'Back', action: 'openingBack', variant: 'quiet', testId: 'opening-back' }) : createButton({ label: 'Title', action: 'goToTitle', variant: 'quiet' }),
      createButton({ label: view.canQuickStart ? 'Skip: repeat last party' : 'Skip: use defaults', action: 'openingSkip', variant: 'quiet', testId: 'opening-skip' }),
    ]);
    replaceScreen([
      createElement('h1', { className: 'screen-title', text: `Daulat Beg · ${step + 1} of ${view.steps}` }),
      createElement('blockquote', { className: 'speech', dataset: { testid: 'opening-speech' }, text: `"${view.speech}"` }),
      ...body, nav,
    ], 'opening');
  }

  /** @returns {string} the leader name typed in beat 0, or '' */
  function readOpeningName() {
    const input = document.getElementById('opening-name');
    return input ? input.value : '';
  }

  // ---------------------------------------------------------------------------
  // Stop screen: Town, Caravan, Learn (GDD 2.3)
  // ---------------------------------------------------------------------------

  function createTownTab(state) {
    const node = State.getNode(state);
    const panels = [createElement('p', { className: 'paragraph stop-blurb', text: node.notes })];
    if (node.tier === 'none') return [...panels, createPanel('Market', [createElement('p', { className: 'paragraph', text: 'There is no market here. Only the post and the pass.' })])];
    const capacity = State.getCapacity(state);
    const load = State.getLoad(state);
    const cargoPanel = [];
    if (state.cargo && state.cargo.units > 0) {
      const first = Math.round(State.getCargoBasePrice(state, state.nodeId, state.cargo.id));
      cargoPanel.push(createElement('p', { className: 'paragraph', text: `${Config.CARGO[state.cargo.id].label}: you hold ${state.cargo.units} lots (condition ${Math.round(state.cargo.condition * 100)}%). Today's price for the first unit: ${first} rupees; each unit sold lowers the next.` }));
      cargoPanel.push(createElement('div', { className: 'button-row' }, Config.MARKET.LOT_FRACTIONS.map((fraction) => {
        const units = Math.max(1, Math.ceil(state.cargo.units * fraction - 1e-9));
        return createButton({ label: `Sell ${Math.round(fraction * 100)}% (${units} · ~${State.quoteSale(state, units).revenue})`, action: 'sellLot', argument: fraction, testId: `sell-${Math.round(fraction * 100)}` });
      })));
    } else cargoPanel.push(createElement('p', { className: 'paragraph', text: 'You have no cargo left. It cannot be bought again on this road.' }));
    panels.push(createPanel('Sell cargo', cargoPanel));

    panels.push(createPanel('Buy supplies', [
      createElement('p', { className: 'paragraph', text: `Load ${load} of ${capacity} units. Cargo and supplies must fit.` }),
      createMeter('Load', Math.min(load, capacity), capacity || 1, load > capacity ? 'meter__fill--danger' : ''),
      createElement('div', { className: 'button-column' }, [
        createButton({ label: `Rations ×10 · ${State.getBuyPrice(state, 'rations')} rupees`, action: 'buySupply', argument: 'rations', testId: 'buy-food', isDisabled: state.money < State.getBuyPrice(state, 'rations') }),
        createButton({ label: `Feeds ×10 · ${State.getBuyPrice(state, 'feeds')} rupees`, action: 'buySupply', argument: 'feeds', testId: 'buy-fodder', isDisabled: state.money < State.getBuyPrice(state, 'feeds') }),
        createButton({ label: `Medicine ×1 · ${State.getBuyPrice(state, 'medicine')} rupees (${(State.ensurePool(state, state.nodeId).pools[state.nodeId] || { medicine: 0 }).medicine} in stock)`, action: 'buySupply', argument: 'medicine', testId: 'buy-med' }),
        createButton({ label: `Waxed cover · ${State.getBuyPrice(state, 'covers')} rupees · 2 LU`, action: 'buySupply', argument: 'covers', testId: 'buy-cover', isDisabled: state.money < State.getBuyPrice(state, 'covers') }),
      ]),
    ]));

    const pool = State.ensurePool(state, state.nodeId).pools[state.nodeId];
    if (node.hasAnimalMarket) {
      panels.push(createPanel('Animal market', pool.animals.length === 0 ? [createElement('p', { className: 'paragraph', text: 'No animals for sale today.' })]
        : [createElement('div', { className: 'button-column' }, pool.animals.map((listing) => createButton({ label: `${label(listing.type)} · health ${Math.round(listing.hp)} · carries ${State.roundToTenth(Config.ANIMALS[listing.type].capacity * listing.quality)} · ${Engine.getAnimalPrice(state, listing)} rupees`, action: 'buyAnimal', argument: listing.id, testId: `animal-${listing.id}`, isDisabled: state.money < Engine.getAnimalPrice(state, listing) })))]));
    }
    panels.push(createElement('details', { className: 'caravan-panel' }, [
      createElement('summary', { text: 'Sell surplus (at a loss)' }),
      createElement('div', { className: 'button-column' }, [
        createButton({ label: 'Sell 10 rations', action: 'sellSurplus', argument: 'rations', isDisabled: state.supplies.rations < 10 }),
        createButton({ label: 'Sell 10 feeds', action: 'sellSurplus', argument: 'feeds', isDisabled: state.supplies.feeds < 10 }),
        ...state.animals.map((animal) => createButton({ label: `Sell ${animal.type} (health ${Math.round(animal.hp)})`, action: 'sellAnimal', argument: animal.id })),
      ]),
    ]));
    return panels;
  }

  function createHireSection(state, edge) {
    if (!edge) return [];
    const pool = State.ensurePool(state, state.nodeId).pools[state.nodeId];
    const sections = [];
    const guideActive = state.hired.some((hire) => hire.type === 'guide' && hire.untilRegion === edge.region);
    sections.push(createPanel('Guide for the next region', guideActive ? [createElement('p', { className: 'paragraph', text: 'Your guide is hired. The briefing below is exact.' })]
      : [createElement('p', { className: 'paragraph', text: 'A guide gives the exact region briefing, a 3-day forecast, no lost days and faster passes. He leaves at the region boundary.' }),
        createElement('div', { className: 'button-column' }, Config.SERVICES.guide.tiers.map((tier) => createButton({ label: `${tier.label} guide · ${Engine.getHirePrice(state, 'guide', tier.id)} rupees`, action: 'hire', argument: `guide:${tier.id}`, testId: `guide-${tier.id}`, isDisabled: state.money < Engine.getHirePrice(state, 'guide', tier.id) })))]));
    const hands = (type, list, text) => createPanel(`${label(type)}s to the next city`, list.length === 0 ? [createElement('p', { className: 'paragraph', text: `No ${type}s are available.` })]
      : [createElement('p', { className: 'paragraph', text }), createElement('div', { className: 'button-column' }, list.map((item) => createButton({ label: `${item.name} · ${label(item.tier)} · ${Engine.getHirePrice(state, type, item.tier)} rupees`, action: 'hire', argument: `${type}:${item.tier}:${item.id}`, testId: `${type}-${item.id}`, isDisabled: state.money < Engine.getHirePrice(state, type, item.tier) })))]);
    sections.push(hands('scout', pool.scouts, 'A scout forecasts 3 days, shows the exact threat and removes lost days. He leaves at the next city.'));
    sections.push(hands('guard', pool.guards, 'A guard defends against bandits and wildlife and eats a ration a day. Guards leave at the next city.'));
    return sections;
  }

  function createCaravanTab(state, edge) {
    const hiredText = state.hired.length === 0 ? 'No hired hands.' : state.hired.map((hire) => `${hire.name} (${hire.type}, ${hire.tier})`).join(', ');
    return [
      createPanel('Your party', [createPartyList(state, true), createElement('p', { className: 'paragraph', text: `Hired hands: ${hiredText}` })]),
      createPanel('Pace and rations', [createStepper('Pace', Config.PACES, state.pace, 'setPace', 'pace'), createStepper('Rations', Config.RATIONS, state.rationLevel, 'setRations', 'ration')]),
      ...createHireSection(state, edge),
    ];
  }

  function createLearnTab(state, edge) {
    const node = State.getNode(state);
    const regionId = edge ? edge.region : node.region;
    const briefing = Engine.getRegionBriefing(state, regionId);
    const asks = Content.CODEX.filter((card) => card.nodeId === node.id && card.unlock === 'ask');
    const subplot = Content.SUBPLOTS[state.subplotId];
    const learnedHere = Content.CODEX.filter((card) => card.nodeId === node.id && state.codex.includes(card.id));
    return [
      createPanel(`Next region: ${briefing.name}${briefing.isGuided ? ' (guided: exact)' : ' (ranges)'}`, [
        createElement('ul', { className: 'briefing' }, [
          createElement('li', { text: `Sarai: ${briefing.sarai}` }), createElement('li', { text: `Fodder: ${briefing.fodder}` }),
          createElement('li', { text: `Hunt ${rangeText(briefing.hunt)} · Fish ${rangeText(briefing.fish)} · Forage ${rangeText(briefing.forage)} (0-3)` }),
          createElement('li', { text: `Threats: Bandits ${rangeText(briefing.threat.bandit)} · Wildlife ${rangeText(briefing.threat.wildlife)} · Officials ${rangeText(briefing.threat.authority)} · Theft ${rangeText(briefing.threat.theft)} · Disease ${rangeText(briefing.threat.disease)} · Flood ${rangeText(briefing.threat.flood)} (0-5)` }),
          createElement('li', { text: `Weather: ${createForecastWeather(state)}` }),
        ]),
      ]),
      createPanel('Rumours', state.rumours.length === 0 ? [createElement('p', { className: 'paragraph', text: 'None yet. Sarais and brokers sell rumours; about 6 in 10 are right.' })] : [createElement('ul', { className: 'record-list' }, state.rumours.slice(-5).reverse().map((rumour) => createElement('li', { text: rumour.text })))]),
      asks.length > 0 ? createPanel('Ask around', [createElement('div', { className: 'button-column' }, asks.map((card) => createButton({ label: state.codex.includes(card.id) ? `${card.title} ✓` : `Ask about: ${card.title}`, action: 'askCard', argument: card.id, testId: `ask-${card.id}`, isDisabled: state.codex.includes(card.id), variant: state.codex.includes(card.id) ? 'quiet' : 'secondary' })))]) : null,
      learnedHere.length > 0 ? createPanel(`Learned at ${node.name}`, learnedHere.flatMap((card) => [createElement('h3', { className: 'card-title', text: card.title }), createElement('p', { className: 'paragraph', text: card.text })])) : null,
      createPanel(subplot.label, [createElement('p', { className: 'paragraph', text: `${subplot.qualityLabel}: ${state.qualities[subplot.quality] || 0}. Reputation: ${state.qualities.reputation}.` })]),
      createButton({ label: 'Open the full codex', action: 'openCodex', variant: 'quiet' }),
    ].filter(Boolean);
  }

  function createCoachCard(state, edge) {
    const forecast = Engine.computeSupplyForecast(state, edge);
    const rationsNeeded = Math.ceil(State.getRationsPerDay(state) * forecast.legDays);
    return createElement('aside', { className: 'coach', role: 'note' }, [
      createElement('h2', { className: 'coach__title', text: 'Daulat Beg advises' }),
      ...createParagraphs([`The whole road to Dhaka is ${World.TOTAL_KOS} kos. Next leg: ${edge.kos} kos, about ${forecast.legDays} days.`, `Carry at least ${rationsNeeded} rations for it, and a few days more for trouble.`]),
      createButton({ label: 'Got it', action: 'dismissCoach', testId: 'coach-skip', variant: 'quiet' }),
    ]);
  }

  function showStop(state) {
    const node = State.getNode(state);
    const edge = World.getOutgoingEdges(state.nodeId)[0] || null;
    const sceneCanvas = createSceneCanvas('stop-canvas', `Illustration of ${node.name}`);
    withContext(sceneCanvas, (ctx) => paintStopScene(ctx, node.id));
    const tabs = [['town', 'Town'], ['caravan', 'Caravan'], ['learn', 'Learn']];
    const tabList = createElement('div', { className: 'tabs', role: 'tablist', 'aria-label': 'Stop sections' }, tabs.map(([tabId, text]) => createElement('button', { type: 'button', className: `tab ${activeStopTab === tabId ? 'tab--active' : ''}`.trim(), role: 'tab', id: `tab-${tabId}`, 'aria-selected': String(activeStopTab === tabId), 'aria-controls': 'tab-panel', text, dataset: { action: 'selectTab', argument: tabId, testid: `tab-${tabId}`, focusKey: `tab-${tabId}` } })));
    const builders = { town: () => createTownTab(state), caravan: () => createCaravanTab(state, edge), learn: () => createLearnTab(state, edge) };
    const tabPanel = createElement('div', { className: 'tab-panel', role: 'tabpanel', id: 'tab-panel', 'aria-labelledby': `tab-${activeStopTab}` }, builders[activeStopTab]());
    const actionBar = createElement('div', { className: 'action-bar' });
    if (edge) {
      const forecast = createForecastLine(state, edge);
      actionBar.appendChild(createElement('p', { className: `forecast ${forecast.warning ? 'forecast--warning' : ''}`.trim(), role: 'status', dataset: { testid: 'forecast' }, text: forecast.text }));
      actionBar.appendChild(createElement('div', { className: 'action-bar__buttons' }, [
        createButton({ label: `Set out for ${World.findNode(edge.to).name} \u00b7 ${edge.kos} kos`, action: 'setOut', testId: 'action-setout', variant: 'primary', className: 'button--seal' }),
        createButton({ label: 'Stay a day', action: 'restDay', testId: 'action-rest' }),
      ]));
    } else {
      actionBar.appendChild(createElement('p', { className: 'forecast', text: 'Dhaka is the end of the road. Sell what you will, then finish.' }));
      actionBar.appendChild(createElement('div', { className: 'action-bar__buttons' }, [createButton({ label: 'Finish the journey', action: 'finishJourney', testId: 'action-finish', variant: 'primary' }), createButton({ label: 'Stay a day', action: 'restDay', testId: 'action-rest' })]));
    }
    const showCoach = edge && state.nodeId === World.FIRST_NODE_ID && !state.flags.coachDismissed && state.dayIndex === 0;
    replaceScreen([createHud(state), createElement('main', { className: 'stop-main' }, [createElement('h1', { className: 'screen-title', text: node.name }), sceneCanvas, showCoach ? createCoachCard(state, edge) : null, tabList, tabPanel]), actionBar], 'stop');
  }

  // ---------------------------------------------------------------------------
  // Road screen
  // ---------------------------------------------------------------------------

  function showRoad(state, view) {
    const edge = State.getEdge(state);
    const forecast = createForecastLine(state, edge);
    const canvas = getRoadCanvas();
    const caravanPanel = createElement('details', { className: 'caravan-panel', dataset: { testid: 'caravan-details' } }, [
      createElement('summary', { text: 'Caravan: pace, rations, party' }),
      createStepper('Pace', Config.PACES, state.pace, 'setPace', 'pace'), createStepper('Rations', Config.RATIONS, state.rationLevel, 'setRations', 'ration'),
      createPartyList(state, true),
    ]);
    if (view.isCaravanPanelOpen) caravanPanel.setAttribute('open', '');
    const forecastText = Engine.getForecast(state);
    replaceScreen([
      createHud(state),
      createElement('main', { className: 'travel-main' }, [
        canvas,
        createElement('p', { className: 'route-label', dataset: { testid: 'route-label' }, text: `${World.findNode(edge.from).name} \u2192 ${World.findNode(edge.to).name} \u00b7 ${Math.min(edge.kos, Math.floor(state.kosOnEdge))} of ${edge.kos} kos` }),
        createElement('progress', { className: 'travel-progress', max: String(edge.kos), value: String(Math.min(edge.kos, state.kosOnEdge)), dataset: { testid: 'travel-progress' }, 'aria-label': 'Progress along this road' }),
        createElement('p', { className: 'forecast', dataset: { testid: 'weather-line' }, text: `${weatherText(state.weather.today)} · Tomorrow: ${forecastText[0] ? Config.WEATHER[forecastText[0].shown].label : '?'}` }),
        createElement('p', { className: `forecast ${forecast.warning ? 'forecast--warning' : ''}`.trim(), role: 'status', dataset: { testid: 'forecast' }, text: forecast.text }),
        createElement('div', { className: 'button-row' }, [
          createButton({ label: state.isPaused ? 'Resume' : 'Pause', action: 'togglePause', testId: 'travel-pause', variant: 'primary' }),
          createButton({ label: 'Rest here', action: 'restDay', testId: 'travel-rest' }),
        ]),
        state.isPaused ? createElement('p', { className: 'banner banner--info', role: 'status', text: 'Paused. Tap Resume to continue.' }) : null,
        state.vignette ? createElement('p', { className: 'vignette', dataset: { testid: 'vignette' }, text: state.vignette }) : null,
        caravanPanel,
        createElement('ul', { className: 'trail-log', 'aria-live': 'polite', 'aria-label': 'Recent events' }, state.log.slice(-3).map((entry) => createElement('li', { text: entry.text }))),
        createButton({ label: 'Full log', action: 'openLog', testId: 'log-full', variant: 'quiet' }),
      ]),
    ], 'road');
  }

  // ---------------------------------------------------------------------------
  // Provisioning minigame screen
  // ---------------------------------------------------------------------------

  const SKIN_TEXT = Object.freeze({ hunt: { title: 'The hunt', hint: 'Tap an animal to shoot. Near misses are free; clear misses cost an arrow.' }, fish: { title: 'Fishing', hint: 'Tap a fish shadow when its ring is small and bright. Early or late taps scare it.' }, forage: { title: 'Foraging', hint: 'Tap fruit, roots and grass. Dark, spotted plants are decoys.' } });

  /** @returns {{canvas:HTMLCanvasElement, update:(text:string)=>void}} */
  function showProvisionScreen(skin) {
    const canvas = createSceneCanvas('hunt-field', `${SKIN_TEXT[skin].title}. ${SKIN_TEXT[skin].hint} Arrow keys move the cursor; Space or Enter acts.`);
    canvas.setAttribute('tabindex', '0');
    const status = createElement('p', { className: 'forecast', role: 'status', 'aria-live': 'polite', dataset: { testid: 'hunt-status' } });
    replaceScreen([createElement('main', { className: 'hunt-main' }, [
      createElement('h1', { className: 'screen-title', text: SKIN_TEXT[skin].title }),
      createElement('p', { className: 'paragraph', text: `${SKIN_TEXT[skin].hint} Arrow keys move the cursor; Space or Enter acts.` }),
      canvas, status,
    ])], 'provision');
    canvas.focus({ preventScroll: true });
    return { canvas, update(text) { status.textContent = text; } };
  }

  // ---------------------------------------------------------------------------
  // End screen (GDD 9.10)
  // ---------------------------------------------------------------------------

  const SUBPLOT_ENDINGS = Object.freeze({
    book: ['Your notebook is thin. The road is mostly in your head.', 'Your notebook holds a decent account of the road.', 'A patron in Dhaka asks to read your book, and keeps it a week.'],
    spy: ['You were watched all the way. The letter is in other hands now.', 'The letter reaches its reader, a little worn.', 'You deliver the letter unseen. Someone owes you a favour.'],
    lover: ['You found no trace. The road keeps its secret.', 'You find a name and a house, and an open door.', 'You find the one who left. What happens next is theirs to say.'],
    government: ['The governor\'s office has no place for a stranger.', 'The acquaintance puts in a word, and you are heard.', 'Your name is known. A post is offered in Bengal.'],
  });

  function showEnd(state) {
    closeAllModals();
    const outcome = state.outcome;
    const hasArrived = outcome.type === 'arrived';
    const rows = hasArrived ? [['Final wealth (cash, cargo at Dhaka price, animals)', outcome.finalWealth], ['Profit ratio', `×${outcome.ratio}`], ['Journey score', outcome.base], ['Subplot bonus', outcome.subplot], ['Codex points', outcome.codex]] : [['Carried value (25%) and codex points', outcome.score]];
    const table = createElement('table', { className: 'score-table' }, [createElement('tbody', {}, [
      ...rows.map(([text, value]) => createElement('tr', {}, [createElement('th', { scope: 'row', text }), createElement('td', { text: String(value) })])),
      createElement('tr', { className: 'score-table__total' }, [createElement('th', { scope: 'row', text: 'Final score' }), createElement('td', { dataset: { testid: 'end-score' }, text: String(outcome.score) })]),
    ])]);
    const tier = outcome.verdict === 'ruin' ? 0 : (outcome.verdict === 'fair' ? 1 : 2);
    const learned = Content.CODEX.filter((card) => state.codex.includes(card.id));
    const dead = state.party.filter((member) => !member.isAlive);
    const children = [
      createElement('h1', { className: 'screen-title', text: hasArrived ? 'Dhaka' : 'The road claims the caravan' }),
      createElement('p', { className: 'paragraph', text: hasArrived ? `${state.leaderName}'s caravan reached Dhaka on ${outcome.dateLabel}, after ${state.dayIndex} days. ${State.getLivingCount(state)} of ${state.party.length} survived.` : `The journey ended on ${outcome.dateLabel}, after ${state.dayIndex} days.` }),
      createPanel('Ledger', [table]),
      hasArrived ? createPanel('Daulat Beg writes', [createElement('p', { className: 'paragraph', text: `"${Content.DAULAT_BEG.verdicts[outcome.verdict]}"` })]) : createPanel('What the road taught you', [createElement('p', { className: 'paragraph', text: Content.LESSONS[outcome.cause] })]),
      createPanel(Content.SUBPLOTS[state.subplotId].label, [createElement('p', { className: 'paragraph', text: SUBPLOT_ENDINGS[state.subplotId][tier] })]),
      dead.length > 0 ? createPanel('Graves', [createElement('ul', { className: 'record-list' }, dead.map((member) => createElement('li', { text: `${member.name} (${member.role ? Config.ROLES[member.role].label : 'Leader'}) · ${member.cause} · day ${member.dayOfDeath}` })))]) : null,
      createPanel('What you learned', learned.length === 0 ? [createElement('p', { className: 'paragraph', text: 'Nothing recorded.' })] : [createElement('ul', { className: 'record-list' }, learned.map((card) => createElement('li', { text: card.title })))]),
    ];
    if (dead.length > 0) children.push(createElement('label', { className: 'field' }, [createElement('span', { className: 'field__label', text: 'Epitaph for the roadside grave (optional)' }), createElement('input', { className: 'field__input', type: 'text', id: 'epitaph', maxlength: String(Config.LIMITS.MAX_EPITAPH_LENGTH), autocomplete: 'off', dataset: { testid: 'end-epitaph', enterAction: 'finishRun' } })]));
    children.push(createButton({ label: dead.length > 0 ? 'Leave graves and return' : 'Record the result', action: 'finishRun', testId: 'end-leave-grave', variant: 'primary' }));
    replaceScreen(children.filter(Boolean), 'end');
  }

  function readEpitaph() {
    const input = document.getElementById('epitaph');
    return input ? input.value : '';
  }

  // ---------------------------------------------------------------------------
  // Sheets
  // ---------------------------------------------------------------------------

  function openCodex(state) {
    openSheet({
      title: 'Codex', testId: 'codex',
      build(body) {
        const learnedIds = state ? state.codex : [];
        World.NODES.forEach((node) => {
          const cards = Content.CODEX.filter((card) => card.nodeId === node.id);
          if (cards.length === 0) return;
          body.appendChild(createElement('h3', { className: 'card-title', text: node.name }));
          cards.forEach((card) => {
            const isLearned = learnedIds.includes(card.id);
            body.appendChild(createElement('div', { className: `codex-card ${isLearned ? '' : 'codex-card--locked'}`.trim() }, [
              createElement('strong', { text: isLearned ? card.title : '???' }),
              createElement('p', { className: 'paragraph', text: isLearned ? `${card.text}${card.confidence === 'low' ? ' (Low confidence.)' : ''}` : (card.unlock === 'ask' ? 'Ask around at this place to learn more.' : 'Visit this place to learn more.') }),
            ]));
          });
        });
        body.appendChild(createElement('p', { className: 'footnote', text: 'Cards are short summaries for learning. Source checks are still in progress, so treat them as a starting point. Dates use the modern (Gregorian) calendar; England still used the Julian calendar in 1665. Prices keep historical ratios, but the rupee is a play-scale unit.' }));
        body.appendChild(createButton({ label: 'Close', action: 'closeSheet', variant: 'primary' }));
      },
    });
  }

  function openLog(state) {
    openSheet({ title: 'Trail log', testId: 'log', build(body) {
      body.appendChild(createElement('ol', { className: 'trail-log trail-log--full' }, [...state.log].reverse().map((entry) => createElement('li', { text: `Day ${entry.dayIndex}: ${entry.text}` }))));
      body.appendChild(createButton({ label: 'Close', action: 'closeSheet', variant: 'primary' }));
    } });
  }

  function openSettings(settings, isStorageSupported) {
    openSheet({
      title: 'Settings', testId: 'settings',
      build(body) {
        const group = (legend, items, action, current, prefix) => createElement('fieldset', { className: 'stepper' }, [createElement('legend', { className: 'stepper__legend', text: legend }), createElement('div', { className: 'stepper__buttons' }, items.map(([value, text]) => createButton({ label: text, action, argument: value, testId: `${prefix}-${value}`, variant: current === value ? 'primary' : 'secondary', isPressed: current === value })))]);
        body.appendChild(group('Text size', [[100, 'A'], [115, 'A+'], [130, 'A++']], 'setTextSize', settings.textSizePercent, 'settings-textsize'));
        body.appendChild(group('Theme', [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']], 'setTheme', settings.theme, 'settings-theme'));
        body.appendChild(group('Sleep in a sarai', [['ask', 'Ask me'], ['always', 'When I can afford it'], ['never', 'Never']], 'setSaraiDefault', settings.saraiDefault, 'settings-sarai'));
        body.appendChild(createElement('div', { className: 'button-column' }, [
          createButton({ label: `Reduced motion: ${settings.reducedMotion === 'on' ? 'On' : 'Follow device'}`, action: 'toggleReducedMotion', isPressed: settings.reducedMotion === 'on' }),
          createButton({ label: `Minigame assists (bigger targets, more time): ${settings.hasAssists ? 'On' : 'Off'}`, action: 'toggleAssists', isPressed: settings.hasAssists }),
          createButton({ label: 'Export save file', action: 'exportSave', testId: 'settings-export' }),
          createElement('label', { className: 'button button--secondary file-button' }, ['Import save file', createElement('input', { type: 'file', accept: '.json,application/json', className: 'visually-hidden', dataset: { changeAction: 'importSave', testid: 'settings-import' } })]),
          createButton({ label: 'Reset saved game', action: 'confirmResetSave', testId: 'settings-reset', variant: 'danger' }),
        ]));
        body.appendChild(createElement('p', { className: 'footnote', text: `Version ${Config.GAME_VERSION}. Saving: ${isStorageSupported ? 'on (this browser)' : 'unavailable in this browser mode'}.` }));
        body.appendChild(createButton({ label: 'Close', action: 'closeSheet', variant: 'primary' }));
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Utilities used by game.js
  // ---------------------------------------------------------------------------

  function applySettings(settings) {
    const root = document.documentElement;
    root.style.setProperty('font-size', `${settings.textSizePercent}%`);
    if (settings.theme === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', settings.theme);
    root.dataset.reducedMotion = settings.reducedMotion;
  }

  function flashSaved() {
    const indicator = document.getElementById('save-indicator');
    if (!indicator) return;
    const actionBar = document.querySelector('.action-bar');
    indicator.style.bottom = `${(actionBar ? actionBar.offsetHeight : 0) + 8}px`;
    indicator.textContent = 'Saved \u2713';
    indicator.classList.add('save-indicator--visible');
    if (savedIndicatorTimer) clearTimeout(savedIndicatorTimer);
    savedIndicatorTimer = setTimeout(() => { indicator.classList.remove('save-indicator--visible'); indicator.textContent = ''; }, SAVED_INDICATOR_MILLISECONDS);
  }

  function showNotice(text, tone) {
    const notice = document.getElementById('notice');
    if (!notice) return;
    notice.textContent = text;
    notice.className = text ? `banner banner--${tone || 'info'}` : '';
  }

  const toggleHudExpanded = () => { isHudExpanded = !isHudExpanded; };
  const setStopTab = (tabId) => { activeStopTab = ['town', 'caravan', 'learn'].includes(tabId) ? tabId : 'town'; };

  namespace.UI = Object.freeze({
    initialize, showTitle, showOpening, readOpeningName, showStop, showRoad, showProvisionScreen, showEnd, readEpitaph,
    showPending, closePending, hasOpenModal, openSheet, closeTopSheet, closeAllModals, confirmAction,
    openCodex, openLog, openSettings, applySettings, flashSaved, showNotice, toggleHudExpanded, setStopTab,
    getRoadCanvas, renderRoadFrame, paintRoadScene, paintStopScene, withContext, fillRectangle, drawBlock, drawDisc, drawEllipse, PALETTE, createElement,
  });
})(window.Karvanyan);
