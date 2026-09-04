import {
  CSS_FLIP,
  DEFAULT_PLACEMENT,
  PLACEMENTS,
  boundaryFitCandidates,
  estimatePlacementRect,
  getPlacement,
  placementAxis,
} from './placements.js';
import { ensureBaseStyles } from './styles.js';

let seq = 0;
const nextId = () => `ap-${++seq}-${Math.random().toString(36).slice(2, 7)}`;
const FLIP_STICKY_PX = 8;

/**
 * @typedef {object} AnchorPopoverOptions
 * @property {string} [placement]
 * @property {string | number} [offset]
 * @property {string | number} [duration]
 * @property {string} [ariaHasPopup]
 * @property {string | HTMLElement | null} [boundary]
 * @property {ParentNode} [root]
 */

const STYLE_VARS = [
  '--anchor-name',
  '--anchor-area',
  '--anchor-offset',
  '--anchor-fallbacks',
  '--anchor-duration',
];

function setAttr(el, name, value) {
  if (value == null || value === '') el.removeAttribute(name);
  else el.setAttribute(name, String(value));
}

function clearVars(el) {
  if (!el) return;
  for (const name of STYLE_VARS) el.style.removeProperty(name);
}

function cssTimeToMs(value) {
  const v = String(value).trim();
  if (!v) return 0;
  if (v.endsWith('ms')) return Number.parseFloat(v) || 0;
  if (v.endsWith('s')) return (Number.parseFloat(v) || 0) * 1000;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeOffset(offset) {
  if (offset == null || offset === '') return '4px';
  if (typeof offset === 'number') return `${offset}px`;
  return /^\d+(\.\d+)?$/.test(offset) ? `${offset}px` : offset;
}

function normalizeDuration(duration) {
  if (duration == null || duration === '') return '0s';
  if (typeof duration === 'number') return `${duration}ms`;
  if (/^\d+(\.\d+)?$/.test(String(duration))) return `${duration}ms`;
  return String(duration);
}

function isOpen(content) {
  if (content.hasAttribute('data-anchor-open')) return true;
  try {
    return content.matches(':popover-open');
  } catch {
    return false;
  }
}

function resolveChild(root, selectors) {
  for (const selector of selectors) {
    const found = root.querySelector?.(selector);
    if (found instanceof HTMLElement) return found;
  }
  return null;
}

/** @param {Node} node */
function composedParent(node) {
  if (node instanceof Element && node.assignedSlot) return node.assignedSlot;
  if (node.parentElement) return node.parentElement;
  const root = node.getRootNode();
  return root instanceof ShadowRoot ? root.host : null;
}

/**
 * `Element#closest` stops at a shadow root. Walk the composed tree instead.
 *
 * @param {Element} el
 * @param {string} selector
 */
function closestComposed(el, selector) {
  let node = el;
  while (node instanceof Element) {
    try {
      if (node.matches(selector)) return node;
    } catch {
      return null;
    }
    node = composedParent(node);
  }
  return null;
}

/** @param {Node} ancestor @param {Node} node */
function composedContains(ancestor, node) {
  let current = node;
  while (current) {
    if (current === ancestor) return true;
    current = composedParent(current);
  }
  return false;
}

function queryShadowBoundary(trigger, selector) {
  const seen = new Set();
  const visit = (node) => {
    if (!(node instanceof Element) || !node.shadowRoot || seen.has(node.shadowRoot)) return null;
    seen.add(node.shadowRoot);
    const hit = node.shadowRoot.querySelector(selector);
    return hit instanceof HTMLElement && composedContains(hit, trigger) ? hit : null;
  };

  for (let node = trigger; node; node = composedParent(node)) {
    const found = visit(node);
    if (found) return found;
  }
  for (let node = trigger.parentElement; node; node = node.parentElement) {
    const found = visit(node);
    if (found) return found;
  }
  return null;
}

function resolveBoundary(trigger, spec) {
  if (spec instanceof HTMLElement) {
    return !trigger || composedContains(spec, trigger) ? spec : null;
  }
  const token = String(spec ?? '').trim();
  if (!token || !trigger) return null;
  try {
    const closest = closestComposed(trigger, token);
    if (closest instanceof HTMLElement) return closest;
    const shadowed = queryShadowBoundary(trigger, token);
    if (shadowed) return shadowed;
  } catch {
    console.warn(`anchor-popover: invalid boundary selector "${token}"`);
  }
  return null;
}

export class AnchorPopoverController {
  /** @param {AnchorPopoverOptions} [options] */
  constructor(options = {}) {
    this.id = nextId();
    /** @type {AnchorPopoverOptions} */
    this.options = { ...options };
    /** @type {HTMLElement | null} */
    this.trigger = null;
    /** @type {HTMLElement | null} */
    this.content = null;
    this.#abort = null;
    this.#ownedPopover = false;
    this.#ownedId = false;
    this.#boundaryEl = null;
    this.#boundaryPosOwned = false;
    this.#boundaryTransformOwned = false;
    this.#fitName = null;
    this.#resizeObs = null;
    this.#fitting = false;
    this.#moveAnim = null;
  }

  #abort;
  #ownedPopover;
  #ownedId;
  /** @type {HTMLElement | null} */
  #boundaryEl;
  #boundaryPosOwned;
  #boundaryTransformOwned;
  /** @type {string | null} */
  #fitName;
  /** @type {ResizeObserver | null} */
  #resizeObs;
  #fitting;
  /** @type {Animation | null} */
  #moveAnim;

  get #animates() {
    return cssTimeToMs(normalizeDuration(this.options.duration)) > 0;
  }

  /** @param {AnchorPopoverOptions} [patch] */
  connect(patch) {
    if (patch) Object.assign(this.options, patch);

    const root = this.options.root ?? document;
    const kids = [...(root.children ?? [])].filter((node) => node instanceof HTMLElement);
    this.trigger = resolveChild(root, ['[data-trigger]', 'button']) ?? kids[0] ?? null;
    this.content =
      resolveChild(root, ['[data-content]', '[popover]', 'dialog']) ?? kids[1] ?? null;

    if (!this.trigger || !this.content || this.trigger === this.content) {
      throw new Error('anchor-popover: nest a trigger and content (button + panel).');
    }

    ensureBaseStyles();
    ensureBaseStyles(this.trigger.getRootNode());
    ensureBaseStyles(this.content.getRootNode());

    this.#syncBoundary();
    if (this.#boundaryEl) ensureBaseStyles(this.#boundaryEl.getRootNode());
    this.#wire();
    this.#render();
    return this;
  }

  disconnect() {
    this.#abort?.abort();
    this.#abort = null;
    this.#resizeObs?.disconnect();
    this.#resizeObs = null;
    this.#fitName = null;
    this.#clearMove();
    this.#releaseBoundary();
    clearVars(this.trigger);
    clearVars(this.content);

    if (this.trigger) {
      this.trigger.removeAttribute('data-anchor-role');
      if (this.trigger.getAttribute('popovertarget') === this.content?.id) {
        this.trigger.removeAttribute('popovertarget');
      }
    }

    if (this.content) {
      this.content.removeAttribute('data-anchor-role');
      this.content.removeAttribute('data-anchor-animate');
      this.content.removeAttribute('data-anchor-open');
      this.content.removeAttribute('data-anchor-local');
      this.content.removeAttribute('data-anchor-axis');
      if (this.#ownedPopover) this.content.removeAttribute('popover');
      if (this.#ownedId) this.content.removeAttribute('id');
    }

    this.trigger = null;
    this.content = null;
  }

  /** @param {AnchorPopoverOptions} patch */
  update(patch) {
    if ('placement' in patch || 'offset' in patch) this.#fitName = null;
    Object.assign(this.options, patch);
    if (!this.trigger || !this.content) return this;
    this.#refreshBoundary();
    this.#render();
    this.#scheduleConstrain();
    return this;
  }

  show() {
    if (!this.content) return;
    this.#refreshBoundary();
    if (isOpen(this.content)) return;
    if (this.#usesTopLayer()) {
      try {
        this.content.showPopover(this.trigger ? { source: this.trigger } : undefined);
      } catch {
        this.content.showPopover();
      }
    } else {
      this.#setLocalOpen(true);
    }
    this.#syncExpanded();
    this.#scheduleConstrain();
  }

  hide() {
    this.#clearMove();
    if (!this.content || !isOpen(this.content)) return;
    if (this.#usesTopLayer()) this.content.hidePopover();
    else this.#setLocalOpen(false);
    this.#syncExpanded();
  }

  toggle() {
    if (!this.content) return;
    if (isOpen(this.content)) this.hide();
    else this.show();
  }

  get open() {
    return this.content ? isOpen(this.content) : false;
  }

  #wire() {
    this.#abort?.abort();
    this.#abort = new AbortController();
    this.#resizeObs?.disconnect();
    this.#resizeObs = null;
    const { signal } = this.#abort;
    const { trigger, content } = this;

    if (!content.id) {
      content.id = this.id;
      this.#ownedId = true;
    }

    this.#syncPopover();

    content.addEventListener(
      'toggle',
      () => {
        this.#syncExpanded();
        if (this.open) this.#scheduleConstrain();
        else this.#fitName = null;
      },
      { signal },
    );

    if (!this.#usesTopLayer()) {
      trigger.addEventListener(
        'click',
        (event) => {
          event.preventDefault();
          this.toggle();
        },
        { signal },
      );
      document.addEventListener(
        'pointerdown',
        (event) => {
          if (!this.open) return;
          const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
          if (path.includes(content) || path.includes(trigger)) return;
          const target = event.target;
          if (target instanceof Node && (content.contains(target) || trigger.contains(target))) return;
          this.hide();
        },
        { signal, capture: true },
      );
      document.addEventListener(
        'keydown',
        (event) => {
          if (event.key === 'Escape' && this.open) this.hide();
        },
        { signal },
      );
    }

    if (this.#boundaryEl) {
      const onChange = () => this.#scheduleConstrain();
      this.#boundaryEl.addEventListener('scroll', onChange, { signal, passive: true });
      window.addEventListener('scroll', onChange, { capture: true, signal, passive: true });
      window.addEventListener('resize', onChange, { signal });
      this.#resizeObs = new ResizeObserver(onChange);
      this.#resizeObs.observe(this.#boundaryEl);
      this.#resizeObs.observe(content);
    }
  }

  #usesTopLayer() {
    return !this.#boundaryEl;
  }

  #refreshBoundary() {
    const prev = this.#boundaryEl;
    this.#syncBoundary();
    if (this.#boundaryEl) ensureBaseStyles(this.#boundaryEl.getRootNode());
    if (this.#boundaryEl !== prev) this.#wire();
    else this.#syncPopover();
  }

  #syncPopover() {
    const { trigger, content } = this;
    if (!trigger || !content) return;

    if (this.#boundaryEl) {
      if (content.hasAttribute('popover') && content.matches?.(':popover-open')) {
        try {
          content.hidePopover();
        } catch {
          /* closed */
        }
      }
      content.removeAttribute('popover');
      trigger.removeAttribute('popovertarget');
      this.#ownedPopover = false;
      return;
    }

    content.removeAttribute('data-anchor-open');
    if (!content.hasAttribute('popover')) this.#ownedPopover = true;
    content.setAttribute('popover', 'auto');
    trigger.setAttribute('popovertarget', content.id);
  }

  #syncBoundary() {
    this.#releaseBoundary();
    if (!this.trigger) return;
    const box = resolveBoundary(this.trigger, this.options.boundary);
    if (!box) return;
    this.#boundaryEl = box;
    box.setAttribute('data-anchor-boundary-box', this.id);
    if (getComputedStyle(box).position === 'static') {
      box.style.position = 'relative';
      this.#boundaryPosOwned = true;
    }
  }

  #releaseBoundary() {
    if (!this.#boundaryEl) return;
    if (this.#boundaryPosOwned) {
      this.#boundaryEl.style.removeProperty('position');
      this.#boundaryPosOwned = false;
    }
    if (this.#boundaryTransformOwned) {
      this.#boundaryEl.style.removeProperty('transform');
      this.#boundaryTransformOwned = false;
    }
    if (this.#boundaryEl.getAttribute('data-anchor-boundary-box') === this.id) {
      this.#boundaryEl.removeAttribute('data-anchor-boundary-box');
    }
    this.#boundaryEl = null;
  }

  #setLocalOpen(open) {
    const content = this.content;
    const trigger = this.trigger;
    if (!content || !trigger) return;
    const wasOpen = isOpen(content);
    if (wasOpen === open) return;
    content.toggleAttribute('data-anchor-open', open);
    const newState = open ? 'open' : 'closed';
    const oldState = wasOpen ? 'open' : 'closed';
    try {
      content.dispatchEvent(new ToggleEvent('toggle', { bubbles: true, newState, oldState }));
    } catch {
      const event = new Event('toggle', { bubbles: true });
      Object.defineProperty(event, 'newState', { value: newState });
      Object.defineProperty(event, 'oldState', { value: oldState });
      content.dispatchEvent(event);
    }
  }

  #syncExpanded() {
    this.trigger?.setAttribute('aria-expanded', String(this.open));
  }

  #scheduleConstrain() {
    if (!this.#boundaryEl || this.#moveAnim) return;
    requestAnimationFrame(() => this.#constrainToBoundary());
  }

  #visibleBox(el) {
    const rect = el.getBoundingClientRect();
    return {
      top: rect.top + el.clientTop,
      left: rect.left + el.clientLeft,
      right: rect.left + el.clientLeft + el.clientWidth,
      bottom: rect.top + el.clientTop + el.clientHeight,
    };
  }

  #overflowAmount(rect, box) {
    return (
      Math.max(0, box.top - rect.top) +
      Math.max(0, rect.bottom - box.bottom) +
      Math.max(0, box.left - rect.left) +
      Math.max(0, rect.right - box.right)
    );
  }

  #clearMove() {
    this.#moveAnim?.cancel();
    this.#moveAnim = null;
    this.content?.style.removeProperty('transform');
  }

  /** @param {DOMRect} from */
  #playMove(from) {
    const el = this.content;
    if (!el || !this.#animates || !from.width || !from.height) return;
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const to = el.getBoundingClientRect();
    const dx = from.left - to.left;
    const dy = from.top - to.top;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;

    this.#clearMove();
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    const duration = cssTimeToMs(normalizeDuration(this.options.duration));
    const anim = el.animate(
      [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
      { duration, easing: 'ease', fill: 'forwards' },
    );
    this.#moveAnim = anim;
    const finish = () => {
      if (this.#moveAnim !== anim) return;
      this.#moveAnim = null;
      el.style.removeProperty('transform');
      try {
        anim.cancel();
      } catch {
        /* already finished */
      }
      this.#scheduleConstrain();
    };
    anim.finished.then(finish, finish);
  }

  #constrainToBoundary() {
    if (this.#fitting || this.#moveAnim) return;
    if (!this.open || !this.content || !this.trigger || !this.#boundaryEl) return;
    if (!this.content.offsetWidth || !this.content.offsetHeight) return;

    const box = this.#visibleBox(this.#boundaryEl);
    const requested =
      this.options.placement && this.options.placement in PLACEMENTS
        ? this.options.placement
        : DEFAULT_PLACEMENT;
    const startName = this.#fitName && this.#fitName in PLACEMENTS ? this.#fitName : requested;
    const trigger = this.trigger.getBoundingClientRect();
    const size = { width: this.content.offsetWidth, height: this.content.offsetHeight };
    const offset = Number.parseFloat(String(this.options.offset ?? 4)) || 0;
    const estimatedOverflow = (name) =>
      this.#overflowAmount(estimatePlacementRect(name, trigger, size, offset), box);

    const startOverflow = estimatedOverflow(startName);
    if (startOverflow < 1) {
      this.#fitName = startName;
      return;
    }

    const candidates = boundaryFitCandidates(requested);
    let best = startName;
    let bestOverflow = startOverflow;
    for (const name of candidates) {
      const estimated = estimatedOverflow(name);
      if (estimated < bestOverflow) {
        bestOverflow = estimated;
        best = name;
      }
      if (estimated < 1) {
        best = name;
        bestOverflow = estimated;
        break;
      }
    }

    if (best === startName || startOverflow - bestOverflow < FLIP_STICKY_PX) return;

    const from = this.content.getBoundingClientRect();
    this.#fitting = true;
    try {
      this.#fitName = best;
      this.#render();
    } finally {
      this.#fitting = false;
    }
    this.#playMove(from);
  }

  #render() {
    const { trigger, content, options } = this;
    let area;
    try {
      area = getPlacement(this.#fitName ?? options.placement);
    } catch {
      area = getPlacement(DEFAULT_PLACEMENT);
    }

    const constrained = Boolean(this.#boundaryEl);
    const offset = normalizeOffset(options.offset);
    const duration = normalizeDuration(options.duration);
    const anchorName = `--${this.id}`;

    trigger.setAttribute('data-anchor-role', 'trigger');
    content.setAttribute('data-anchor-role', 'content');
    content.setAttribute('data-anchor-axis', placementAxis(this.#fitName ?? options.placement));
    content.toggleAttribute('data-anchor-animate', this.#animates);
    content.toggleAttribute('data-anchor-local', constrained);
    setAttr(trigger, 'aria-controls', content.id);
    setAttr(trigger, 'aria-haspopup', options.ariaHasPopup ?? 'true');
    trigger.setAttribute('aria-expanded', String(this.open));

    trigger.style.setProperty('--anchor-name', anchorName);
    content.style.setProperty('--anchor-name', anchorName);
    content.style.setProperty('--anchor-area', area);
    content.style.setProperty('--anchor-offset', offset);
    content.style.setProperty('--anchor-fallbacks', constrained ? 'none' : CSS_FLIP);
    content.style.setProperty('--anchor-duration', duration);
  }
}
