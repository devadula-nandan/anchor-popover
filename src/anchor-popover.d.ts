export type Placement =
  | 'block-start'
  | 'block-start-start'
  | 'block-start-end'
  | 'block-end'
  | 'block-end-start'
  | 'block-end-end'
  | 'inline-start'
  | 'inline-start-start'
  | 'inline-start-end'
  | 'inline-end'
  | 'inline-end-start'
  | 'inline-end-end';

export const PLACEMENTS: Record<Placement, string>;
export const PLACEMENT_NAMES: Placement[];
export const DEFAULT_PLACEMENT: Placement;

export interface AnchorPopoverOptions {
  placement?: Placement | string;
  offset?: string | number;
  duration?: string | number;
  ariaHasPopup?: string;
  /** CSS selector or element. Omit / empty = document viewport. */
  boundary?: string | HTMLElement | null;
  root?: ParentNode;
}

export function supportsAnchorPositioning(): boolean;
export function supportsPopover(): boolean;

export class AnchorPopoverController {
  readonly id: string;
  options: AnchorPopoverOptions;
  trigger: HTMLElement | null;
  content: HTMLElement | null;
  readonly open: boolean;
  constructor(options?: AnchorPopoverOptions);
  connect(patch?: AnchorPopoverOptions): this;
  disconnect(): void;
  update(patch: AnchorPopoverOptions): this;
  show(): void;
  hide(): void;
  toggle(): void;
}

export class AnchorPopover extends HTMLElement {
  static tagName: 'anchor-popover';
  static observedAttributes: string[];
  static readonly placements: Placement[];
  static readonly supports: {
    anchor: typeof supportsAnchorPositioning;
    popover: typeof supportsPopover;
  };
  static define(tag?: string): typeof AnchorPopover;

  readonly controller: AnchorPopoverController | null;
  readonly triggerElement: HTMLElement | null;
  readonly contentElement: HTMLElement | null;

  placement: string;
  offset: string;
  duration: string;
  boundary: string;
  readonly open: boolean;

  show(): void;
  hide(): void;
  toggle(): void;
}

declare global {
  interface HTMLElementTagNameMap {
    'anchor-popover': AnchorPopover;
  }
}
