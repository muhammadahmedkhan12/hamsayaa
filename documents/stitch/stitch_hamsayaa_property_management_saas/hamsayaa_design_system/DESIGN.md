---
name: Hamsayaa Design System
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#45464d'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#006c49'
  on-secondary: '#ffffff'
  secondary-container: '#6cf8bb'
  on-secondary-container: '#00714d'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#0b1c30'
  on-tertiary-container: '#75859d'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#d3e4fe'
  tertiary-fixed-dim: '#b7c8e1'
  on-tertiary-fixed: '#0b1c30'
  on-tertiary-fixed-variant: '#38485d'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
  status-unpaid: '#EF4444'
  status-overdue: '#B91C1C'
  status-warning: '#F59E0B'
  status-verified: '#10B981'
  status-open: '#3B82F6'
  surface-muted: '#F1F5F9'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  code-pass:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '700'
    lineHeight: 24px
    letterSpacing: 0.1em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  container-max: 1440px
  gutter: 1.5rem
  margin-mobile: 1rem
  stack-sm: 0.5rem
  stack-md: 1rem
  stack-lg: 2rem
---

## Brand & Style

The design system is built for **Hamsayaa**, a property management SaaS that bridges the gap between high-tech AI automation (WhatsApp/Gemini) and the grounded, physical reality of gated community security. 

The visual style is **Corporate / Modern** with a **High-Contrast** edge. It is designed to feel authoritative, "no-nonsense," and utilitarian, reflecting the serious nature of dues collection, vehicle tracking, and security enforcement. The UI avoids unnecessary decoration, prioritizing information density and rapid scanability for administrators who need to manage complex data at a glance.

**Key Brand Pillars:**
- **Authoritative:** Deep navies and high-contrast typography suggest stability and trust.
- **Urgent:** High-visibility status indicators (Amber/Red) ensure critical alerts like overstays and unpaid bills are never missed.
- **Efficient:** A "shadcn-like" technical aesthetic that feels like a professional tool rather than a social app.

## Colors

The palette is anchored by **Deep Navy Blue (#0F172A)**, used for navigation and core branding to establish a professional, enterprise-grade foundation. 

The system utilizes a **functional color language** to communicate status without requiring the user to read text labels:
- **Success & Verification:** Forest Green (#10B981) is used for "Paid," "Resolved," and "Verified" states.
- **Alerts & Warnings:** Amber (#F59E0B) is used for "Pending" or "In Progress" states, while Red (#EF4444) and Dark Red (#B91C1C) are reserved for "Unpaid" and "Overdue/Overstay" alerts.
- **Backgrounds:** A soft Slate/Muted Blue (#F8FAFC) background reduces eye strain during long administrative sessions while maintaining a clean, modern look.

## Typography

This design system uses **Inter** exclusively to ensure maximum legibility across both the web dashboard and generated image assets. 

**Special Considerations:**
- **Hierarchy:** Strong weight differentiation (Bold vs. Regular) is used to separate data labels from user data in tables.
- **Pass Codes:** For the `pass_code` on Visitor Passes, use the `code-pass` style. It features increased letter spacing and bold weight to ensure security guards can read the code easily on mobile screens in varying light conditions.
- **Labels:** Use uppercase for `label-md` in data tables and metric cards to provide a clear "form-like" structure.

## Layout & Spacing

The design system employs a **12-column fluid grid** for the main dashboard, optimizing for a desktop-first administrative experience while remaining responsive.

- **Dashboard Layout:** Features a fixed left-hand navigation sidebar (Navy) and a fluid content area.
- **Metric Cards:** Arranged in a responsive grid at the top of pages, spanning 3 or 4 columns on desktop.
- **Data Tables:** These are the heart of the system. They should stretch to fill the container width, using horizontal scrolling on smaller screens rather than hiding columns to maintain data integrity.
- **WhatsApp Assets:** Visitor passes must follow a **compact layout** (max-width 400px) to ensure they are fully visible on WhatsApp without excessive scrolling.

## Elevation & Depth

To maintain a "technical" and "clean" feel, the system uses **Tonal Layers** and **Low-Contrast Outlines** rather than heavy shadows.

- **Level 0 (Background):** Soft Slate (#F8FAFC).
- **Level 1 (Cards/Content):** Pure White (#FFFFFF) with a 1px border (#E2E8F0).
- **Level 2 (Modals/Popovers):** Pure White with a soft, diffused ambient shadow (10% opacity, 12px blur) to provide focus during manual data entry (e.g., logging a vehicle entry).
- **Real-time Alerts:** Overstay alerts should appear as a "floating" toast or a high-contrast top-bar to break the standard layout hierarchy and demand immediate attention.

## Shapes

The design system uses a **Soft (0.25rem)** roundedness approach. This creates a modern feel without appearing overly "bubbly" or consumer-oriented, maintaining the professional SaaS aesthetic.

- **Small (rounded-sm):** 0.125rem for checkboxes and small tags.
- **Base (rounded):** 0.25rem for buttons and input fields.
- **Large (rounded-lg):** 0.5rem for metric cards and main content containers.
- **Status Pills:** Use a full pill shape (999px) for status indicators (e.g., "Paid," "Overstay") to make them instantly recognizable as distinct from interactive buttons.

## Components

### Buttons & Inputs
- **Primary Button:** Solid Deep Navy (#0F172A) with white text. High-contrast and authoritative.
- **Action Buttons:** Use Forest Green for "Resolve" or "Verify" actions.
- **Input Fields:** Clean, white background with a subtle border. Focus states should use a 2px Deep Navy ring.

### Metric Cards
- Large numeric values in Deep Navy.
- Iconography (Lucide) in the top right, color-coded to the metric's health (e.g., Red icon for total Overstays).
- Bottom-aligned trend or status text.

### Data Tables (The "Enforcement" View)
- Zebra-striping is avoided; use subtle 1px bottom borders.
- **Status Chips:** High-contrast background with dark text for scannability. "Overdue" should use a light red background with dark red text.
- **Action Row:** Every row for residents should have a "WhatsApp Message" quick-action icon.

### WhatsApp Visitor Passes
- Must be rendered as a card with a clear header ("VISITOR PASS").
- The `pass_code` must be the most prominent visual element.
- Include a "Verified" watermark/badge if the CNIC has been provided.

### Chat Bubbles (Mobile-First)
- While Hamsayaa lives in WhatsApp, the Admin dashboard should preview these messages using standard chat bubble UI:
  - **Resident:** Light gray bubbles, left-aligned.
  - **AI Bot:** Deep Navy bubbles, right-aligned, with a small "AI" badge.