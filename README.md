# anchor-popover

Headless web component for **Popover API + CSS Anchor Positioning**. The host is `display: contents`

## Markup

```html
<link rel="stylesheet" href="./src/anchor-popover.css" />
<script type="module" src="./src/index.js"></script>

<anchor-popover placement="block-end-end" offset="8" duration="200" aria-haspopup="menu">
  <button data-trigger type="button">Open</button>
  <div data-content>Menu</div>
</anchor-popover>
```

Trigger is `[data-trigger]` or the first child. Content is `[data-content]` or the second child.

## Attributes

| Attribute | Default | Notes |
|---|---|---|
| `placement` | `block-end` | Logical `position-area` token (see below) |
| `offset` | `4` | Gap. Bare numbers become `px` |
| `duration` | `0` | Open/close fade and JS flip. Bare numbers become `ms`. `0` is instant |
| `boundary` | — | Selector or element. Omit for the document viewport |
| `aria-haspopup` | `true` | Copied onto the trigger |

Block: `block-start`, `block-start-start`, `block-start-end`, `block-end`, `block-end-start`, `block-end-end`

Inline: `inline-start`, `inline-start-start`, `inline-start-end`, `inline-end`, `inline-end-start`, `inline-end-end`

## Boundary

No `boundary` → popover top layer, CSS `position-try` against the window.

`boundary="#sidebar"` → that ancestor is the overflow box. The selector is resolved through slots and **open shadow roots** of composed ancestors (so `.wrap` can live inside a parent’s shadow). The menu leaves the top layer and JavaScript flips against the visible client rect.

## JS

```js
const el = document.querySelector('anchor-popover');
el.placement = 'block-start-start';
el.offset = 12;
el.duration = 200;
el.show();
el.hide();
el.toggle();
```

`--anchor-max-width` caps the panel (`16rem` by default). Override it on the content node:

```css
.menu {
  --anchor-max-width: 24rem;
}
```

## Demo

- Playground: https://devadula-nandan.github.io/anchor-popover/demo/
- Scenarios: https://devadula-nandan.github.io/anchor-popover/demo/scenarios.html

```sh
python3 -m http.server 5173
```

Open `http://localhost:5173/demo/` locally.
