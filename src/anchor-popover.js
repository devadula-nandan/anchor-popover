import { AnchorPopoverController } from './controller.js';
import { supportsAnchorPositioning, supportsPopover } from './polyfill.js';
import { DEFAULT_PLACEMENT, PLACEMENT_NAMES, PLACEMENTS } from './placements.js';

const ATTRS = ['placement', 'offset', 'duration', 'aria-haspopup', 'boundary'];

/** Wait until parent custom elements (and their shadow trees) have upgraded. */
function whenCustomAncestorsDefined(el) {
  const waits = [];
  for (let node = el.parentElement; node; node = node.parentElement) {
    const name = node.localName;
    if (!name.includes('-')) continue;
    if (!customElements.get(name)) waits.push(customElements.whenDefined(name));
  }
  return waits.length ? Promise.all(waits) : Promise.resolve();
}

export class AnchorPopover extends HTMLElement {
  static tagName = 'anchor-popover';
  static observedAttributes = ATTRS;
  static get placements() {
    return PLACEMENT_NAMES;
  }
  static supports = {
    anchor: supportsAnchorPositioning,
    popover: supportsPopover,
  };

  static define(tag = AnchorPopover.tagName) {
    if (!customElements.get(tag)) customElements.define(tag, this);
    return this;
  }

  /** @type {AnchorPopoverController | null} */
  #controller = null;
  #ready = false;
  /** @type {MutationObserver | null} */
  #mo = null;

  get controller() {
    return this.#controller;
  }

  get triggerElement() {
    return this.#controller?.trigger ?? null;
  }

  get contentElement() {
    return this.#controller?.content ?? null;
  }

  get placement() {
    return this.getAttribute('placement') ?? DEFAULT_PLACEMENT;
  }
  set placement(value) {
    this.#set('placement', value);
  }

  get offset() {
    return this.getAttribute('offset') ?? '4';
  }
  set offset(value) {
    this.#set('offset', value == null ? null : String(value));
  }

  get duration() {
    return this.getAttribute('duration') ?? '0';
  }
  set duration(value) {
    this.#set('duration', value == null ? null : String(value));
  }

  get boundary() {
    return this.getAttribute('boundary') ?? '';
  }
  set boundary(value) {
    this.#set('boundary', value);
  }

  get open() {
    return this.#controller?.open ?? false;
  }

  show() {
    this.#controller?.show();
  }

  hide() {
    this.#controller?.hide();
  }

  toggle() {
    this.#controller?.toggle();
  }

  connectedCallback() {
    this.#ready = true;
    this.#mo = new MutationObserver(() => this.#remount());
    this.#mo.observe(this, { childList: true });
    queueMicrotask(() => {
      this.#mount();
    });
  }

  disconnectedCallback() {
    this.#ready = false;
    this.#mo?.disconnect();
    this.#mo = null;
    this.#controller?.disconnect();
    this.#controller = null;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (!this.#ready || oldValue === newValue) return;
    this.#controller?.update(this.#optionsFromAttrs());
  }

  #set(name, value) {
    if (value == null || value === '') this.removeAttribute(name);
    else this.setAttribute(name, String(value));
  }

  #optionsFromAttrs() {
    return {
      placement: this.getAttribute('placement') ?? DEFAULT_PLACEMENT,
      offset: this.getAttribute('offset') ?? 4,
      duration: this.getAttribute('duration') ?? 0,
      ariaHasPopup: this.getAttribute('aria-haspopup') ?? undefined,
      boundary: this.getAttribute('boundary') || undefined,
      root: this,
    };
  }

  async #mount() {
    await whenCustomAncestorsDefined(this);
    if (!this.isConnected || this.children.length === 0) return;
    if (this.#controller) {
      this.#controller.update(this.#optionsFromAttrs());
      return;
    }
    try {
      this.#controller = new AnchorPopoverController(this.#optionsFromAttrs());
      this.#controller.connect();
    } catch (error) {
      this.#controller = null;
      if (!String(error?.message ?? '').includes('nest a trigger')) throw error;
    }
  }

  #remount() {
    this.#controller?.disconnect();
    this.#controller = null;
    this.#mount();
  }
}

AnchorPopover.define();

export { PLACEMENTS, PLACEMENT_NAMES, DEFAULT_PLACEMENT };
export { AnchorPopoverController } from './controller.js';
export { supportsAnchorPositioning, supportsPopover } from './polyfill.js';
