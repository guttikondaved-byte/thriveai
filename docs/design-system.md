# Thrive Design System

> Source of truth for colors, typography, spacing, and component patterns. Derived from `artifacts/stride-iq/src/index.css`. All CSS custom properties are defined there — this document explains the intent behind each token.

---

## Color palette

### Core tokens

| Name | CSS variable | Hex approx | HSL |
|---|---|---|---|
| Background | `--background` | `#06070E` | 237 40% 4% |
| Surface / Card | `--card` | `#0C0F1A` | 237 40% 6% |
| Border | `--border` | `#182220` | 174 10% 13% |
| Input | `--input` | `#182220` | 174 10% 13% |
| Foreground | `--foreground` | `#F5F5F5` | 0 0% 96% |
| Muted background | `--muted` | `#0E1916` | 174 10% 10% |
| Muted text | `--muted-foreground` | `#8A9287` | 93 12% 55% |
| Ring / focus | `--ring` | `#3D7A74` | 174 31% 38% |

### Brand colors

| Name | CSS variable | Hex approx | Role |
|---|---|---|---|
| **Athlete Teal** | `--primary` | `#3D7A74` | Primary interactive, athlete-coded UI |
| Teal deep | _(inline)_ | `#2A504C` | Shadows, glows, deep teal accents |
| **Coach Blush** | `--accent` | `#F2D2CF` | Coach-coded UI, secondary accent |
| Sage muted | _(inline)_ | `#A2AE98` | Eyebrow labels, social proof chips |

### Semantic colors

| Name | CSS variable | Hex approx | Role |
|---|---|---|---|
| Destructive | `--destructive` | `#E53E3E` | Injury alerts, error states |
| Strava orange | _(inline)_ | `#FB923C` | Strava-related UI elements |

### Dual-audience color coding

**This is the defining visual convention of the product.** Teal (`#3D7A74`) always codes athlete-facing content. Blush (`#F2D2CF`) always codes coach-facing content. Apply consistently to:
- Section eyebrow labels
- Checkmarks in feature lists
- Badge borders and fills
- CTA button styles
- Icon colors
- Ambient section glows

### Chart palette

| Token | HSL | Use |
|---|---|---|
| `--chart-1` | 174 31% 38% | Primary data series (teal) |
| `--chart-2` | 93 12% 64% | Secondary series (sage) |
| `--chart-3` | 5 57% 78% | Tertiary series (blush-rose) |
| `--chart-4` | 174 20% 28% | Deep teal series |
| `--chart-5` | 93 8% 45% | Dark sage series |

### Utility values

```css
--elevate-1: rgba(255,255,255, 0.04)   /* subtle surface lift */
--elevate-2: rgba(255,255,255, 0.09)   /* stronger surface lift */
--button-outline: rgba(255,255,255, 0.10)
--badge-outline: rgba(255,255,255, 0.05)
```

---

## Typography

### Typefaces

| Role | Family | Weights | Usage |
|---|---|---|---|
| **Display** | Syne | 700, 800 | All H1 and H2 headlines on the landing page |
| **Body** | Inter | 400, 500, 600 | All body copy, UI labels, buttons |
| **Mono / Data** | JetBrains Mono | 500 | Stats, metrics, eyebrow labels, code |

Syne is loaded via Google Fonts (`index.html`). Inter and JetBrains Mono are set as the default sans and mono stacks in `@theme inline`.

### Type scale

| Token | Size | Family | Weight | Tracking | Line height |
|---|---|---|---|---|---|
| Hero display | `clamp(3rem, 7vw, 6rem)` | Syne | 800 | `-0.04em` | 1.05 |
| H2 | `clamp(2rem, 4vw, 3.5rem)` | Syne | 700 | `-0.03em` | 1.1 |
| H3 | `1.25rem` | Inter | 600 | `-0.01em` | 1.4 |
| Body | `1rem` | Inter | 400 | `0` | 1.75 |
| Body sm | `0.875rem` | Inter | 400 | `0` | 1.6 |
| Label / Eyebrow | `0.6875rem` | JetBrains Mono | 500 | `0.2em` | 1.4 (uppercase) |
| Stat number | `2rem+` | Syne | 700 | `-0.02em` | 1 |

---

## Spacing

| Token | Value | Usage |
|---|---|---|
| Section padding (desktop) | `py-24` (6rem) | Vertical breathing room between major sections |
| Section padding (mobile) | `py-16` (4rem) | Compressed on small screens |
| Content max-width | `max-w-6xl` (72rem) | All inner content containers |
| Content horizontal padding | `px-6` (1.5rem) | Page-edge gutters |
| Card padding | `p-6` (1.5rem) | Standard card inner padding |
| Card padding large | `p-8` (2rem) | Feature cards, pricing cards |

---

## Border radius

| Token | Value | Usage |
|---|---|---|
| `--radius` (base) | `0.75rem` | Default; used for inputs, small components |
| `rounded-sm` | `calc(0.75rem - 4px)` | Compact elements |
| `rounded-md` | `calc(0.75rem - 2px)` | Medium elements |
| `rounded-lg` | `0.75rem` | Standard cards |
| `rounded-xl` | `calc(0.75rem + 4px)` | Prominent cards |
| `rounded-2xl` | `1rem` | Icon containers, badge-level components |
| `rounded-3xl` | `1.5rem` | Feature cards, testimonial cards |
| `rounded-[2rem]` | `2rem` | Device frames, hero screenshot wrapper |
| `rounded-full` | `9999px` | Pill buttons, avatar circles |

---

## Shadows

The shadow system is intentionally subtle — dark surfaces don't need heavy shadows to create depth; borders and opacity carry that weight instead.

```css
--shadow-sm: 0px 2px 0px 0px rgba(0,0,0,0.1), 0px 1px 2px -1px rgba(0,0,0,0.1)
--shadow-md: 0px 2px 0px 0px rgba(0,0,0,0.1), 0px 2px 4px -1px rgba(0,0,0,0.1)
--shadow-lg: 0px 2px 0px 0px rgba(0,0,0,0.1), 0px 4px 6px -1px rgba(0,0,0,0.1)
```

**Colored shadows** — used for CTA buttons and elevated cards:
- Teal glow: `shadow-lg shadow-primary/20` (`shadow-[#3D7A74]/20`)
- Blush glow: `shadow-lg shadow-[#F2D2CF]/10`

---

## Ambient lighting

Large radial gradients create the illusion of colored light sources behind content. Always `pointer-events-none`, `position: fixed` or `absolute`, `z-index: -10`, low opacity (15–25%).

**Hero / global teal glow (top-center):**
```css
background: radial-gradient(ellipse 60% 40% at 50% -10%, rgba(42,80,76,0.20) 0%, transparent 70%)
```

**Athlete section teal glow (top-center):**
```css
background: radial-gradient(ellipse 70% 50% at 50% -5%, rgba(42,80,76,0.25) 0%, transparent 70%)
```

**Coach section blush glow (bottom-right):**
```css
background: radial-gradient(ellipse 60% 45% at 90% 110%, rgba(242,210,207,0.12) 0%, transparent 65%)
```

**Hero right-side accent:**
```css
background: radial-gradient(ellipse 50% 35% at 90% 70%, rgba(242,210,207,0.08) 0%, transparent 70%)
```

---

## Component patterns

### Buttons

**Primary (teal, filled):**
```jsx
className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/20 hover:bg-primary/90 transition"
```

**Coach CTA (blush, ghost):**
```jsx
className="rounded-full border border-[#F2D2CF]/40 px-6 py-3 text-sm font-semibold text-[#F2D2CF] hover:bg-[#F2D2CF]/10 transition"
```

**Secondary (ghost):**
```jsx
className="rounded-full border border-[#182220] px-6 py-3 text-sm font-semibold text-white/90 hover:border-white/30 transition"
```

**Small nav button:**
```jsx
className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#182220] hover:border-primary/50 bg-[#06070E]/70 backdrop-blur-sm transition-all"
```

### Cards

**Standard feature card:**
```jsx
className="rounded-3xl border border-[#182220] bg-[#0C0F1A] p-6 shadow-sm"
```

**Elevated / hero card (glassmorphism):**
```jsx
className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-3 shadow-2xl shadow-slate-950/40 backdrop-blur-xl"
```

**Testimonial card:**
```jsx
className="rounded-3xl border border-[#182220]/80 bg-[#0C0F1A]/80 p-5 relative overflow-hidden"
```

### Badges / eyebrow labels

**Teal badge (athlete):**
```jsx
className="inline-flex items-center gap-2 text-[11px] font-semibold text-[#A2AE98] bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-full"
```

**Blush badge (coach):**
```jsx
className="inline-flex items-center gap-2 text-[11px] font-semibold text-[#F2D2CF] bg-[#F2D2CF]/10 border border-[#F2D2CF]/20 px-3 py-1.5 rounded-full"
```

### Icon containers

```jsx
// Teal
className="w-11 h-11 rounded-2xl flex items-center justify-center bg-primary/15 border border-primary/20"

// Blush
className="w-11 h-11 rounded-2xl flex items-center justify-center bg-[#F2D2CF]/15 border border-[#F2D2CF]/20"

// Red (alerts/injury)
className="w-11 h-11 rounded-2xl flex items-center justify-center bg-red-500/15 border border-red-500/20"
```

### Section divider

```jsx
<div className="mx-auto h-px w-48 bg-gradient-to-r from-transparent via-[#182220] to-transparent opacity-50" />
```

---

## Motion

- **Page-load hero:** `translateY(12px) → 0`, `opacity: 0 → 1`, 0.5s ease-out. Screenshot delayed 150ms.
- **Scroll reveals:** `IntersectionObserver` threshold 0.15. `opacity: 0 → 1` + `translateY(16px) → 0`, 0.45s.
- **Navbar on scroll:** Transition `background-color` and `box-shadow`, 200ms.
- **Accordion expand:** Smooth `max-height` transition.
- **`prefers-reduced-motion`:** Skip all animations.

No parallax. No looping animations. No particle effects.

---

## Clerk auth styling

The Clerk component appearance is configured in `App.tsx` to match this design system:

```js
variables: {
  colorPrimary: "#2A504C",
  colorForeground: "#f8fafc",
  colorMutedForeground: "#94a3b8",
  colorDanger: "#ef4444",
  colorBackground: "#06070E",
  colorInput: "#0e1a19",
  colorInputForeground: "#f8fafc",
  colorNeutral: "#2A504C",
  fontFamily: "Inter, sans-serif",
  borderRadius: "0.75rem",
}
```

---

## Audience color coding quick reference

| Context | Athletes | Coaches |
|---|---|---|
| Primary hex | `#3D7A74` | `#F2D2CF` |
| Deep hex | `#2A504C` | _(no deep variant)_ |
| Eyebrow text color | `text-[#3D7A74]` | `text-[#F2D2CF]` |
| Checkmark color | `text-primary` | `text-[#F2D2CF]` |
| Card border | `border-primary/40` | `border-[#F2D2CF]/40` |
| CTA style | Teal filled pill | Blush ghost pill |
| Section glow | Teal radial, top-center | Blush radial, bottom-right |
| Lucide icon | `text-primary` | `text-[#F2D2CF]` |
| Role pill in sign-up | `text-primary border-primary/30 bg-primary/10` | `text-[#F2D2CF] border-[#F2D2CF]/30 bg-[#F2D2CF]/10` |
