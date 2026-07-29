---
name: Professional Harmonic System
colors:
  surface: '#f8f9ff'
  surface-dim: '#ccdbf4'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e6eeff'
  surface-container-high: '#dde9ff'
  surface-container-highest: '#d5e3fd'
  on-surface: '#0d1c2f'
  on-surface-variant: '#424751'
  inverse-surface: '#233144'
  inverse-on-surface: '#ebf1ff'
  outline: '#727782'
  outline-variant: '#c2c6d3'
  surface-tint: '#1d5fa8'
  primary: '#003b72'
  on-primary: '#ffffff'
  primary-container: '#00529b'
  on-primary-container: '#a5c7ff'
  inverse-primary: '#a6c8ff'
  secondary: '#3f6653'
  on-secondary: '#ffffff'
  secondary-container: '#beead1'
  on-secondary-container: '#436b58'
  tertiary: '#383b3d'
  on-tertiary: '#ffffff'
  tertiary-container: '#4f5254'
  on-tertiary-container: '#c3c5c7'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d5e3ff'
  primary-fixed-dim: '#a6c8ff'
  on-primary-fixed: '#001c3b'
  on-primary-fixed-variant: '#004787'
  secondary-fixed: '#c1ecd4'
  secondary-fixed-dim: '#a5d0b9'
  on-secondary-fixed: '#002114'
  on-secondary-fixed-variant: '#274e3d'
  tertiary-fixed: '#e0e3e5'
  tertiary-fixed-dim: '#c4c7c9'
  on-tertiary-fixed: '#191c1e'
  on-tertiary-fixed-variant: '#444749'
  background: '#f8f9ff'
  on-background: '#0d1c2f'
  surface-variant: '#d5e3fd'
typography:
  headline-xl:
    fontFamily: Manrope
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Manrope
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Manrope
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  headline-md:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  3xl: 64px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
---

## Brand & Style

The design system centers on **Trust, Stability, and Growth**. It is designed for a professional environment where clarity and reliability are paramount. The visual direction is **Corporate / Modern**, utilizing a structured grid and a sophisticated color palette to evoke a sense of established authority mixed with contemporary efficiency. 

The aesthetic is characterized by high legibility, purposeful whitespace, and a refined use of depth through subtle tonal layering. It avoids unnecessary ornamentation, focusing instead on a "content-first" approach that ensures information is easily scannable and accessible.

## Colors

The palette is anchored by the **Hamsayaa Blue (#00529B)**, a deep, trustworthy navy that serves as the primary brand identifier. This is paired with a **Sophisticated Forest Green (#1B4332)** as the secondary color, used for success states, growth indicators, and professional accents.

The background system uses a tiered Slate scale to create depth:
- **Base Surface:** White (#FFFFFF) for primary content areas.
- **Muted Background:** #F1F5F9 for subtle section differentiation.
- **Structural Depth:** #E2E8F0 for borders, dividers, and inactive states.

Text utilizes **Neutral Slate (#334155)** for high contrast and readability without the harshness of pure black.

## Typography

This design system uses a dual-font approach. **Manrope** is used for all headlines to provide a modern, geometric, and authoritative feel. **Inter** is utilized for body text and labels due to its exceptional legibility in professional, data-heavy interfaces.

- **Headlines:** Use tighter letter-spacing on larger sizes to maintain a compact, premium look.
- **Body:** Standardized on a 16px base for optimal long-form reading comfort.
- **Hierarchy:** Contrast is established through weight (600/700 for headers) rather than just size.

## Layout & Spacing

The layout follows a **Fluid Grid** model with a 4px baseline shift. 

- **Desktop:** 12-column grid with 24px gutters and 40px outer margins.
- **Tablet:** 8-column grid with 20px gutters.
- **Mobile:** 4-column grid with 16px gutters and 16px outer margins.

Spacing should always be applied in multiples of 4px. Use `lg` (24px) for padding within cards and containers to ensure a clean, airy feel that facilitates scanning.

## Elevation & Depth

Visual hierarchy is achieved through **Tonal Layers** and **Ambient Shadows**. 

1. **Level 0 (Base):** Slate backgrounds (#F1F5F9).
2. **Level 1 (Cards/Surface):** White (#FFFFFF) surfaces with a 1px border (#E2E8F0).
3. **Level 2 (Hover/Active):** Very soft, diffused shadow (0px 4px 12px rgba(0, 82, 155, 0.05)) to lift the element without creating clutter.
4. **Level 3 (Modals/Overlays):** Stronger elevation (0px 12px 24px rgba(0, 0, 0, 0.08)).

Avoid heavy drop shadows. Rely on the contrast between the white surfaces and the Slate-muted backgrounds to define boundaries.

## Shapes

The shape language is **Soft**. This provides a professional yet approachable feel. 

- **Standard Elements:** (Inputs, Buttons, Cards) use a 0.25rem (4px) radius.
- **Large Containers:** Use `rounded-lg` (8px) to soften the footprint of heavy components.
- **Interactive Indicators:** Small badges or tags may use `rounded-xl` (12px) for distinctiveness.

## Components

### Buttons
- **Primary:** Solid Hamsayaa Blue (#00529B) with White text.
- **Secondary:** Outlined Blue or Solid Forest Green (#1B4332) for positive actions.
- **Ghost:** Text-only with Slate hover states.
- **Padding:** 12px vertical, 24px horizontal for a substantial, clickable feel.

### Input Fields
- **Default:** White background with #E2E8F0 border.
- **Focus:** 2px solid Hamsayaa Blue border with no "glow" effect.
- **Label:** 14px Inter Medium, positioned above the field.

### Cards
- **Structure:** White background, 1px border (#E2E8F0), 24px internal padding.
- **Header:** Use a light Slate (#F8FAFC) top section for complex cards to separate metadata from content.

### Chips & Badges
- **Status:** Use the Forest Green for "Success" or "Active" states with 10% opacity backgrounds and solid text.
- **Neutral:** Slate-100 backgrounds for categorization.