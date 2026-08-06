---
name: Lead Capture
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#434655'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#943700'
  on-tertiary: '#ffffff'
  tertiary-container: '#bc4800'
  on-tertiary-container: '#ffede6'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#ffdbcd'
  tertiary-fixed-dim: '#ffb596'
  on-tertiary-fixed: '#360f00'
  on-tertiary-fixed-variant: '#7d2d00'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  h1-display:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  h2-header:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  subtitle:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-default:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
  button-text:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 20px
  input-text:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-medium:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  xxl: 32px
  xxxl: 48px
---

## Brand & Style
The design system is engineered for a premium B2B SaaS environment, prioritizing efficiency, clarity, and authority. The aesthetic is rooted in **Modern Minimalism**, drawing inspiration from high-performance developer tools and financial platforms. It evokes a sense of "precision engineering" for lead management.

The interface utilizes expansive whitespace, a restrained color palette, and high-quality typography to reduce cognitive load. Visual hierarchy is established through structural alignment and subtle tonal shifts rather than decorative elements. The result is a professional, reliable environment that signals security and institutional-grade capability to Meta advertisers and enterprise stakeholders.

## Colors
The palette is anchored by **Tech Blue** (#2563EB), utilized purposefully for primary actions and brand presence. **Dark Navy** (#0F172A) serves as the foundation for typography and high-level structural elements, providing the necessary weight for a B2B platform.

The background uses a cool-toned **Clean Gray** (#F8FAFC) to differentiate from pure white and reduce eye strain during long-form data management. Semantic colors (Success, Error, Warning) are saturated enough to provide immediate feedback while maintaining a professional profile that integrates seamlessly with the neutral UI.

## Typography
The system relies exclusively on **Inter** to achieve a systematic, utilitarian feel. The hierarchy is strictly enforced to guide users through complex lead data workflows. 

For mobile viewports, the `h1-display` scales down to 24px to ensure readability without excessive wrapping. Tight letter-spacing is applied to larger headlines to maintain a modern, "compacted" aesthetic characteristic of premium SaaS products. Body text is optimized at 15px for a balance between data density and legibility.

## Layout & Spacing
This design system utilizes a **12-column fluid grid** for dashboard views and a **fixed-width container (640px)** for focused lead-capture forms or settings modals. 

The spacing rhythm is built on a 4px baseline, ensuring all components align to a mathematical grid. Dashboards should maintain a consistent 24px gutter between widgets to provide sufficient "air" between high-density data tables. Margin sizes increase on desktop (32px) to frame the content, while collapsing to 16px on mobile devices.

## Elevation & Depth
Depth is conveyed through **Tonal Layering** and **Low-Contrast Outlines** rather than aggressive shadows. 

The primary surface is the background color, while interactive cards and containers sit on a white (#FFFFFF) surface with a 1px border (#E2E8F0). 
- **Base Level:** Background gray.
- **Card Level:** White surface, 1px border, and a "Soft Card Shadow" (0 4px 20px rgba(15, 23, 42, 0.05)) for subtle lift.
- **Interactive Level:** On hover, borders transition to Primary Blue at low opacity or darken the shadow slightly to indicate clickability.
- **Overlay Level:** Modals use a heavier blur backdrop (8px) to isolate the user's focus.

## Shapes
The shape language is "Soft" yet geometric. To avoid a "childish" or overly consumer-facing look, the system uses conservative radii. 
- **6px (sm):** Used for inputs, small buttons, and tags.
- **10px (md):** Used for standard UI cards, dropdown menus, and lead row containers.
- **16px (lg):** Reserved for large modal containers or featured dashboard widgets.
Buttons and inputs are never fully rounded (pill-shaped) to maintain a professional, structured appearance.

## Components
- **Buttons:** Primary buttons use Tech Blue background with white text. Secondary buttons use a white background with a 1px #E2E8F0 border and Dark Navy text. Height is standardized at 40px for medium.
- **Inputs:** Fields use 16px typography for browser compatibility (preventing iOS auto-zoom). Borders are #CBD5E1, turning Primary Blue on focus with a 2px outer glow.
- **Lead Cards:** High-density rows with 12px internal padding. Use #F1F5F9 for hover states to indicate selection.
- **Chips/Badges:** Small (6px radius) with low-saturation backgrounds of the semantic colors (e.g., Success Green at 10% opacity with 100% opacity text).
- **Data Tables:** Border-collapsed design with #F8FAFC header backgrounds and 1px horizontal dividers only; vertical dividers are avoided to maintain a modern look.
- **Navigation:** A sidebar using Dark Navy (#0F172A) for the background to provide a strong structural anchor to the interface.