export function supportsAnchorPositioning() {
  return (
    typeof CSS !== 'undefined' &&
    (CSS.supports('anchor-name: --x') || CSS.supports('position-anchor: --x'))
  );
}

export function supportsPopover() {
  return typeof HTMLElement !== 'undefined' && typeof HTMLElement.prototype.showPopover === 'function';
}
