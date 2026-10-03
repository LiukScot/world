---
name: World
description: A private night journal for health and money, on one iPhone.
colors:
  night-ink: "#121214"
  card: "#161619"
  card-strong: "#1a1a1d"
  card-soft: "#1e1e22"
  control: "#34343d"
  control-hover: "#41414c"
  border: "#48484f"
  text: "#f5f5f7"
  muted: "#a1a1ad"
  muted-soft: "#6d6d78"
  peony-pink: "#ff5e8a"
  mint-ledger: "#34d399"
  danger: "#ff5a7f"
  danger-strong: "#ff3333"
  success: "#6fe1b0"
  success-fg: "#0a2018"
  warning: "#f5a623"
  warning-soft: "#ffd38a"
  warning-fg: "#2a1a00"
  risk-medium: "#fbbf24"
  risk-high: "#fb7185"
  risk-liquid: "#60a5fa"
typography:
  title:
    fontFamily: "Manrope, system-ui, -apple-system, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Manrope, system-ui, -apple-system, sans-serif"
    fontSize: "17px"
    fontWeight: 800
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Manrope, system-ui, -apple-system, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  control:
    fontFamily: "Manrope, system-ui, -apple-system, sans-serif"
    fontSize: "13px"
    fontWeight: 500
  hint:
    fontFamily: "Manrope, system-ui, -apple-system, sans-serif"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Manrope, system-ui, -apple-system, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.12em"
  eyebrow:
    fontFamily: "Manrope, system-ui, -apple-system, sans-serif"
    fontSize: "10px"
    fontWeight: 800
    letterSpacing: "0.16em"
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "13px"
rounded:
  sm: "10px"
  md: "12px"
  lg: "16px"
  full: "9999px"
spacing:
  unit: "4px"
  page: "40px"
components:
  button-default:
    backgroundColor: "{colors.card-soft}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.full}"
    padding: "12px 20px"
    height: "40px"
  button-primary:
    backgroundColor: "color-mix(in srgb, #ff5e8a 12%, transparent)"
    textColor: "{colors.peony-pink}"
    rounded: "{rounded.full}"
    padding: "12px 20px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "color-mix(in srgb, #ff5e8a 22%, transparent)"
    textColor: "{colors.text}"
  button-danger:
    backgroundColor: "color-mix(in srgb, #ff5a7f 12%, transparent)"
    textColor: "{colors.danger}"
    rounded: "{rounded.full}"
    padding: "12px 20px"
  chip:
    backgroundColor: "{colors.control}"
    textColor: "{colors.muted}"
    typography: "{typography.hint}"
    rounded: "{rounded.full}"
    padding: "4px 12px"
    height: "32px"
  chip-active:
    backgroundColor: "{colors.peony-pink}"
    textColor: "{colors.night-ink}"
    rounded: "{rounded.full}"
  input:
    backgroundColor: "{colors.control}"
    textColor: "{colors.text}"
    typography: "{typography.control}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
  stage:
    backgroundColor: "{colors.card-soft}"
    rounded: "{rounded.md}"
    padding: "20px"
  dash-card:
    backgroundColor: "{colors.card-soft}"
    rounded: "{rounded.md}"
    padding: "12px"
  nav-item-active:
    backgroundColor: "color-mix(in srgb, #ff5e8a 10%, transparent)"
    textColor: "{colors.peony-pink}"
    rounded: "{rounded.sm}"
    padding: "12px"
  scale-slot:
    backgroundColor: "{colors.card-strong}"
    textColor: "{colors.muted}"
    rounded: "{rounded.sm}"
    height: "44px"
---

# Design System: World

## Overview

**Creative North Star: "The Night Journal"**

World is a private notebook opened at the end of the day. The page is
near-black and quiet. Each realm carries one colour, and that colour marks
only where you are and what you are about to save. On a hard day the
screen should feel warm and friendly: soft pill controls, generous touch
targets, and no alarms except where data is at risk.

Depth comes from tonal steps of the same charcoal, not from lines or
shadows. Surfaces get one step lighter as they move toward the hand:
page, card, control. Type is one family, Manrope, which reads friendly
at small sizes. Hierarchy comes from weight and uppercase tracking, not
from extra typefaces.

The system is built for one person on an iPhone, inside a WebView. Mobile
behaviour (safe areas, 16px inputs on touch, full-screen sidebar) is the
primary case. Desktop rules stay in the code but are not a design target.

**Key Characteristics:**
- Dark by default, with three surface themes: dark, grey and oled.
- One accent per realm: Peony Pink for Health, Mint Ledger for Money, and the text colour for Settings.
- Tonal layering instead of borders and shadows.
- Pills for actions and chips; soft rounded rectangles for surfaces and fields.
- Staged entry screens: numbered stages walked top to bottom.

## Colors

Charcoal surfaces in small tonal steps, with one saturated accent per realm.

### Primary
- **Peony Pink** (`peony-pink`): the Health accent. Used for the active nav item, the stage kicker, the primary button text, selected chips and the focus ring.
- **Mint Ledger** (`mint-ledger`): the Money accent. It replaces Peony Pink when `data-realm="money"` and takes exactly the same roles.

### Tertiary
- **Risk scale** (`mint-ledger`, `risk-medium`, `risk-high`, `risk-liquid`): Money risk buckets (low, medium, high, liquid). They stay the same in every theme so the four buckets stay distinguishable.
- **Mood bands** (`success`, `warning`, `danger`): the low, mid and high bands on the nine-step scales. Filled slots use `success-fg` / `warning-fg` text.

### Neutral
- **Night Ink** (`night-ink`): the page background. It is also the text colour on anything filled with the accent, because it is the one colour that contrasts with every realm accent.
- **Card / Card Strong / Card Soft** (`card`, `card-strong`, `card-soft`): three surface steps. Stages and dashboard cards use Card Soft. Menus and idle scale slots use Card Strong.
- **Control / Control Hover** (`control`, `control-hover`): inputs, selects and chips. Each theme sets its own pair so a field stays visible on any card.
- **Border** (`border`): sidebar divider, menu outline, scale-slot hover. Avoid it on content surfaces.
- **Text / Muted / Muted Soft** (`text`, `muted`, `muted-soft`): body text, labels and secondary values, then placeholders and asides.

### Named Rules
**The One Accent Rule.** A screen uses only its realm's accent. Health never shows Mint Ledger, and Money never shows Peony Pink.

**The Themes Own Surfaces Rule.** Themes change only surfaces and text. Realms change only `--accent`. Any theme combines with any realm, so a new colour belongs to one of the two, never both.

**The Tint, Don't Fill Rule.** Buttons and active nav items use the accent at 10–22% over the surface, with accent-coloured text. A solid accent fill is reserved for selected chips and selected menu options.

## Typography

**Body Font:** Manrope (system-ui fallback), loaded at weights 400, 600 and 700.
**Mono Font:** JetBrains Mono, for numeric and code-like values.

**Character:** a rounded, friendly grotesque. All hierarchy comes from weight and tracked uppercase caps.

### Hierarchy
- **Title** (700, 22px, tight tracking): the page h1.
- **Headline** (800, 17px, tight tracking): stage titles. Weight 800 is not loaded, so the browser synthesises it from 700.
- **Body** (400–600, 14px, 1.5): running text and button labels. On touch devices, inputs go up to 16px so iOS does not zoom.
- **Control** (500, 13px): text inside inputs and selects.
- **Hint** (400, 12.5px): prompts under field labels, therapy callouts and chips. Put each sentence on its own line.
- **Label** (700, 11–12px, 0.12–0.16em, uppercase): field labels.
- **Eyebrow** (800, 10px, 0.16em, uppercase): stage kickers ("Stage 2") and card captions.

### Named Rules
**The Caps Are Labels Rule.** Tracked uppercase is only for labels, kickers and captions, at 12px or smaller. Titles and values stay in sentence case.

## Layout

Tailwind's 4px spacing scale is used inside components. Between sibling blocks, between columns and around the page there is one distance, `page` (40px). Entry screens are a single column of stages read top to bottom. Dashboard cards sit on an auto-fill grid with 160px minimum tracks and a 12px gap, so rows line up whatever their length.

Breakpoints are named `mobile` (720px), `wide` (1100px) and `xwide` (1240px). Below `mobile`, the sidebar becomes a full-screen sheet that slides in from the left, padded for safe areas. Items already on screen never move when new ones load.

## Elevation & Depth

The system is flat with tonal layering. Content surfaces have no shadow. A surface reads as raised because its charcoal is one step lighter than the one under it. Shadows appear only on things that float above the page.

### Shadow Vocabulary
- **Float** (`box-shadow: 0 16px 40px rgba(0,0,0,0.45)`): dropdown menus and modals.
- **Lift** (`box-shadow: 0 2px 6px rgba(0,0,0,0.25)`): small raised items.
- **Ring** (`box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 38%, transparent)`): keyboard focus on buttons and controls.
- **Inset accent** (`box-shadow: inset 0 0 0 1px var(--accent)`): focus on inputs and selects.

### Named Rules
**The Floating-Only Shadow Rule.** If it scrolls with the page, it has no shadow.

## Shapes

There are two shape families. Actions and chips are full pills. Surfaces and fields are soft rectangles: fields, nav items and scale slots at 10px, stages, cards and menus at 12px, and larger sheets at 16px. Borders are rare. When one appears, it signals state (the active realm tile, a selected scale slot) rather than structure.

## Components

### Buttons
Soft, tinted pills that read as an invitation, not a command.
- **Shape:** full pill (`rounded.full`), minimum 40px tall. The small size is 34px.
- **Default:** Card Soft background with text colour.
- **Primary:** accent at 12% over the surface, with accent text. On hover the tint goes to 22% and the text turns white.
- **Danger:** the same recipe with `danger`. A confirmed delete uses `danger-strong`.
- **Success:** a brief mint tint after a save.
- **Focus:** the 2px accent ring. Colour and background fade over 150ms.

### Chips
- **Style:** pill, 32px tall, hint-size text, Control background, muted text.
- **Selected:** solid accent fill with Night Ink text and weight 600.
- **Removable:** an 18px round × that turns danger-tinted on hover, only on devices that support hover.

### Cards / Containers
- **Stage:** Card Soft, 12px radius, 20px padding, 20px internal gap. The header is an eyebrow kicker ("Stage N") in the accent next to a 17px headline.
- **Dashboard card:** Card Soft, 12px radius, 12px padding. An eyebrow caption sits above a bold 18px value.
- **Shadow strategy:** none (see Elevation).

### Inputs / Fields
- **Style:** borderless, Control background, 10px radius, 8px × 12px padding, control-size text. The label is a tracked uppercase line above the field, never a placeholder.
- **Focus:** the background moves to Control Hover and a 1px inset accent line appears.
- **Textarea:** resizes vertically, 64px minimum height (54px in therapy worksheets).

### Navigation
- **Sidebar:** Night Ink, divided from the content by Border. Nav items are 10px rounded rows with a 20px icon. Idle items are muted. The active item uses accent text on a 10% accent tint.
- **Realm tiles:** 44px squares (48px on mobile). The active tile uses an accent border, accent icon and a 12% tint, so state is never shown by colour alone.
- **Mobile:** a full-screen sheet with 22px icons and 16px labels.

### Nine-Step Scale (signature)
Mood, depression, anxiety and pain are entered as nine 44px buttons in a row. Every slot up to the chosen value is filled with its own band colour (success, warning, danger), so the row shows both the value and how far up the scale it is. Idle slots use Card Strong with a faint border.

## Do's and Don'ts

### Do:
- **Do** build depth with the Card → Card Soft → Control steps before reaching for a border or shadow.
- **Do** use the realm's `--accent` through tokens, never as a literal hex, so Health, Money and Settings all work.
- **Do** use Night Ink as the text colour on any solid accent fill.
- **Do** keep touch targets at least 40px tall, and inputs at 16px on touch devices.
- **Do** keep warm, friendly copy and shapes on Health screens: pills, soft corners, prompts that stay visible while you answer.

### Don't:
- **Don't** add a light theme default or a pure-white surface. Dark is the default.
- **Don't** show two realm accents on the same screen.
- **Don't** put shadows on cards or stages that scroll with the page.
- **Don't** use a placeholder as the only label or prompt on a field.
- **Don't** signal state by colour alone. Pair it with a border, a fill or text.
