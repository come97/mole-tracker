# Nævus — Design system

Calm, clinical, trustworthy. Light theme, medical blue accent, warm-cool neutrals.
Inspired by the "Nævus" handoff from Claude Design.

The single source of truth for the visual layer lives in
[`src/index.css`](src/index.css) (CSS custom properties on `:root`). This
document explains how those tokens are used in components and screens.

## 1. Palette

### Surfaces
| Token            | Value     | Use                                              |
| ---------------- | --------- | ------------------------------------------------ |
| `--canvas`       | `#eef2f7` | Page-level frame on desktop                      |
| `--bg`           | `#f5f7fb` | App background                                   |
| `--surface`      | `#ffffff` | Cards, sheets, modals                            |
| `--surface-2`    | `#f8fafc` | Nested surfaces, footers inside cards            |
| `--surface-3`    | `#f1f4f9` | Subtle pills, segmented controls, skeleton bg    |
| `--hairline`     | `#e4e8ef` | 1px borders on cards and inputs                  |
| `--hairline-2`   | `#eef1f6` | In-card dividers, softer separators              |
| `--overlay`      | `rgba(11,20,36,0.55)` | Photo overlays, modal scrim          |

### Text
| Token         | Value     | Use                                       |
| ------------- | --------- | ----------------------------------------- |
| `--ink`       | `#0b1424` | Primary text                              |
| `--ink-2`     | `#2c3445` | Secondary text / strong emphasis on muted |
| `--muted`     | `#5a6478` | Helper text, labels                       |
| `--muted-2`   | `#8b93a4` | Tertiary, mono captions                   |
| `--faint`     | `#b3bbc9` | Dot separators, disabled glyphs           |
| `--on-primary`| `#ffffff` | Text on the primary blue                  |

### Primary (medical blue)
`--primary` `#0066e0` with a ramp from `--primary-50` to `--primary-700`,
plus `--primary-tint` (an alpha tint for hover backgrounds).

### Status
- **Success** — `--success` `#1f8a5a` / `--success-50` `#e6f5ee`. Sage green; preferred over a flat green for medical apps.
- **Warning** — `--warning` `#b97a16` / `--warning-50` `#fbf2dc`. Amber. "À surveiller" and duplicate banners.
- **Danger**  — `--danger`  `#c44a4a` / `--danger-50`  `#fbeaea`. Coral-leaning red. Destructive actions and "to delete" markers.

Saturation is intentionally below 60% on all status hues so they read as
medical-adjacent and never alarming.

## 2. Typography

- **Sans** — Geist (loaded via Google Fonts), `-apple-system` fallback.
- **Mono** — Geist Mono. Used for dates, IDs, dimensions, measurements.
- **Never more than 2 typefaces.**

Type scale (utility classes in `index.css`):

| Class       | Size / line-height / weight        | Use                              |
| ----------- | ---------------------------------- | -------------------------------- |
| `.t-display`| 32 / 38 / 600, -0.02em             | Large welcome titles             |
| `.t-h1`     | 24 / 30 / 600, -0.015em            | Page hero titles                 |
| `.t-h2`     | 19 / 25 / 600, -0.01em             | Section headers                  |
| `.t-h3`     | 16 / 22 / 600, -0.005em            | Card titles, list-row titles     |
| `.t-body`   | 15 / 22 / 450                      | Default reading body             |
| `.t-body-sm`| 14 / 20 / 450                      | Compact body, inputs             |
| `.t-cap`    | 12 / 16 / 500                      | Helper text, secondary labels    |
| `.t-micro`  | 11 / 14 / 500, +0.04em, uppercase  | Section labels, field labels     |
| `.t-mono`   | 13 / 18 / 450, mono                | Dates, ISO times                 |
| `.t-mono-sm`| 11 / 14 / 450, mono, -0.01em       | Captions on photo cards          |

## 3. Spacing & radius

4 / 8 px grid. Most paddings are multiples of 4, gaps multiples of 2.

- `--r-xs` 6, `--r-sm` 8, `--r-md` 12 (inputs), `--r-lg` 16 (cards),
  `--r-xl` 20 (photo hero), `--r-2xl` 24, `--r-pill` 999.

## 4. Shadows & focus

- `--e0` hairline border-shadow only
- `--e1` 1-px soft, default for raised list rows
- `--e2` card pop (raised cards, picker hint chip)
- `--e3` phone-frame depth, modal sheets
- `--e-focus` `0 0 0 3px rgba(0,102,224,0.22)` — the only valid focus ring

## 5. Motion

- Durations: `--t-fast` 120ms, `--t-med` 200ms, `--t-slow` 320ms.
- Easing: `--ease` `cubic-bezier(0.22, 1, 0.36, 1)` (gentle ease-out).
- Hovers and active states animate `background` and `transform`. Never spin
  a primary CTA's content — use a progress bar or a `done/total` counter.

## 6. Components

All primitives live in `src/components/ui.tsx` and are re-exported from
`src/components/ui/index.ts`.

| Primitive        | Notes                                                                 |
| ---------------- | --------------------------------------------------------------------- |
| `Icon`           | 24×24 viewBox, `currentColor` stroke. Hand-tuned medical icon set.    |
| `Button`         | `primary` / `secondary` / `ghost` / `tonal` / `danger` / `success`.   |
| `IconButton`     | 36×36 surface button; optional warning badge for the dup count.       |
| `Pill`           | Tone-colored 11px label (neutral / primary / success / warning / danger). |
| `Card`           | 16-radius white card, `--hairline` border.                            |
| `TopBar`         | Page header (title / sub + left + right slots).                       |
| `BottomNav`      | 4 tabs, blue raised primary `+` for Add.                              |
| `Logo`           | Mini blue square + word "Nævus".                                      |
| `FilterChip`     | Active = solid ink, idle = white card.                                |
| `SectionLabel`   | Caps micro + right-extending hairline.                                |
| `Field`          | `label` (micro caps) + optional `hint` + child input.                 |

## 7. States

Every interactive surface must define:
1. **Default** (rest)
2. **Hover** — lighter shade or `--primary-tint` over surface
3. **Active** — `transform: scale(0.99)` for primary CTAs
4. **Focus-visible** — `--e-focus` ring, never removed
5. **Disabled** — `opacity: 0.55`, no hover effect
6. **Loading** — explicit `done/total` counter, never an ambiguous spinner
7. **Error** — `--danger-50` background + `--danger-700` text + icon

## 8. Iconography

Hand-tuned 24px outline icons, `strokeWidth: 1.6` (`2` only for the bottom-nav
`+`). Filled fills are reserved for status badges (warning / success). No emoji
in primary chrome; emoji are acceptable in copy where they carry meaning (e.g.
`🔒` only inside an icon slot, never as standalone text).

## 9. Photo treatment

- Aspect ratios: `4:5` hero, `4:3` review, `1:1` grid, `3:4` compare canvas.
- Border radius: cards `--r-lg`, grid tiles `--r-sm`, compare frame `--r-xl`.
- Always layered on `#000` to avoid skin-tone tint bleed.
- Overlays: date pill (`--overlay`, mono), zoom pill, expand button — all
  blurred (`backdrop-filter: blur(6px)`).

## 10. Copy tone (FR)

- **Factual, kind, never alarmist.** Prefer dated facts ("12 mars 2026")
  to acknowledgements ("Photo enregistrée ✓").
- **Always-relative dates** alongside calendar dates: "12 mars · il y a 3 j".
- **Empty states are pedagogic**, not blank: tell the user what to do next.
- **Medical hedging is explicit**: any size/shape/color delta surface must
  read "indicatif" and recommend the user see a dermatologist for change.

## 11. Accessibility

- AA contrast on every text token over its intended surface.
- `focus-visible` keeps the ring; never `outline: none` without replacement.
- All photos have `alt`; placeholder photos have `aria-hidden="true"`.
- All interactive icons have an `aria-label` even when paired with a label.
- Bottom nav uses `role="tablist"`; primary action retains an `aria-label`.

## 12. PWA

Light theme is the only theme. `theme-color` is `#f5f7fb` (`--bg`). Status
bar mode is `default` (was `black-translucent`). The service worker is
untouched — design changes do not invalidate cache entries.
