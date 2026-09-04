export const BASE_STYLE_ID = 'anchor-popover-base';

export const BASE_CSS = `@layer anchor-popover {
  :where(anchor-popover:not(:defined)) {
    display: none;
  }

  :where(anchor-popover) {
    display: contents;
  }

  [data-anchor-role='trigger'] {
    anchor-name: var(--anchor-name);
  }

  [data-anchor-role='content'] {
    inset: auto;
    margin-block: var(--anchor-offset, 4px);
    margin-inline: 0;
    max-inline-size: var(--anchor-max-width, 16rem);
    position: fixed;
    position-anchor: var(--anchor-name);
    position-area: var(--anchor-area, block-end);
    position-try-fallbacks: var(--anchor-fallbacks, flip-block, flip-inline, flip-block flip-inline);
  }

  [data-anchor-role='content'][data-anchor-local] {
    position: absolute;
  }

  [data-anchor-role='content'][data-anchor-axis='inline'] {
    margin-block: 0;
    margin-inline: var(--anchor-offset, 4px);
  }

  [data-anchor-role='content'][data-anchor-animate] {
    opacity: 0;
    transition:
      display var(--anchor-duration, 0.2s) ease,
      overlay var(--anchor-duration, 0.2s) ease,
      opacity var(--anchor-duration, 0.2s) ease;
    transition-behavior: allow-discrete;
  }

  [data-anchor-role='content'][data-anchor-animate]:popover-open,
  [data-anchor-role='content'][data-anchor-animate][data-anchor-open] {
    opacity: 1;

    @starting-style {
      opacity: 0;
    }
  }

  [data-anchor-role='content'][data-anchor-local]:not([data-anchor-open]) {
    display: none;
  }

  [data-anchor-role='content'][data-anchor-local][data-anchor-open] {
    display: block;
  }

  @media (prefers-reduced-motion: reduce) {
    [data-anchor-role='content'][data-anchor-animate] {
      transition: none;
    }
  }
}
`;

function upsertStyle(id, css) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('style');
    el.id = id;
    (document.head ?? document.documentElement).append(el);
  }
  if (el.textContent !== css) el.textContent = css;
}

/** @type {CSSStyleSheet | null} */
let constructed = null;

function getConstructedSheet() {
  if (constructed) return constructed;
  if (typeof CSSStyleSheet === 'undefined' || typeof CSSStyleSheet.prototype.replaceSync !== 'function') {
    return null;
  }
  constructed = new CSSStyleSheet();
  constructed.replaceSync(BASE_CSS);
  return constructed;
}

/**
 * Inject positioning CSS into the document, and into a shadow root when given.
 * Document styles do not reach shadow trees.
 *
 * @param {Document | ShadowRoot} [root]
 */
export function ensureBaseStyles(root) {
  upsertStyle(BASE_STYLE_ID, BASE_CSS);
  if (!(root instanceof ShadowRoot) || !('adoptedStyleSheets' in root)) return;
  const sheet = getConstructedSheet();
  if (!sheet || root.adoptedStyleSheets.includes(sheet)) return;
  root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
}
