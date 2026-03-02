// =============================================================================
// HabitTracker — Design-System Theme Constants
// =============================================================================
// Single source of truth for colours, spacing, typography, and radii.
// Import from here instead of hard-coding values in components.
// =============================================================================

// -----------------------------------------------------------------------------
// Colours
// -----------------------------------------------------------------------------
/** Core colour palette used throughout the app. */
export const colors = {
  /** Brand primary — buttons, active indicators, links */
  primary: "#6C63FF",

  /** Positive actions — completions, success toasts */
  success: "#4CAF50",

  /** Cautionary states — streak-freeze warnings */
  warning: "#FF9800",

  /** Destructive actions — delete, errors */
  danger: "#F44336",

  /** Root background for all screens */
  background: "#0F0F1A",

  /** Elevated surface colour (cards, modals) */
  card: "#1A1A2E",

  /** Primary text on dark backgrounds */
  text: "#FFFFFF",

  /** Secondary / muted text */
  subtext: "#9E9E9E",
} as const;

// -----------------------------------------------------------------------------
// Spacing Scale
// -----------------------------------------------------------------------------
/**
 * 4-point spacing scale (values in logical pixels).
 * Usage: `spacing.md` for standard padding, `spacing.xl` for section gaps.
 */
export const spacing = {
  /** 4px — hairline gaps, icon-to-label padding */
  xs: 4,

  /** 8px — tight inner padding */
  sm: 8,

  /** 16px — default padding / margin */
  md: 16,

  /** 24px — section separation */
  lg: 24,

  /** 32px — major layout gaps */
  xl: 32,

  /** 48px — screen-level padding, hero spacing */
  xxl: 48,
} as const;

// -----------------------------------------------------------------------------
// Font Sizes
// -----------------------------------------------------------------------------
/**
 * Typographic scale (values in scaled pixels).
 * Pair with a consistent font family set in your app's root layout.
 */
export const fontSizes = {
  /** 12sp — captions, timestamps */
  xs: 12,

  /** 14sp — secondary body text */
  sm: 14,

  /** 16sp — primary body text */
  md: 16,

  /** 20sp — card titles, section headers */
  lg: 20,

  /** 24sp — screen titles */
  xl: 24,

  /** 32sp — hero numbers (streak count, points) */
  xxl: 32,
} as const;

// -----------------------------------------------------------------------------
// Border Radius
// -----------------------------------------------------------------------------
/** Consistent border-radius tokens for rounded UI elements. */
export const borderRadius = {
  /** 4px — subtle rounding (tags, chips) */
  sm: 4,

  /** 8px — cards, inputs */
  md: 8,

  /** 16px — modals, bottom sheets */
  lg: 16,

  /** 9999px — fully rounded (pill buttons, avatars) */
  full: 9999,
} as const;

// -----------------------------------------------------------------------------
// Day Labels                                                   // ← CHANGED: added dayLabels
// -----------------------------------------------------------------------------
/**
 * Short day-of-week labels indexed by JS day number (0 = Sunday … 6 = Saturday).
 * Used in the custom-frequency day picker and calendar grid.
 */
export const dayLabels = [
  "Sun", // 0
  "Mon", // 1
  "Tue", // 2
  "Wed", // 3
  "Thu", // 4
  "Fri", // 5
  "Sat", // 6
] as const;

// -----------------------------------------------------------------------------
// Aggregated Theme Object
// -----------------------------------------------------------------------------
/**
 * Convenience re-export combining every token category.
 * Useful if you prefer a single import:
 *
 *   import { theme } from "@/constants/theme";
 *   theme.colors.primary
 */
export const theme = {
  colors,
  spacing,
  fontSizes,
  borderRadius,
  dayLabels,      // ← CHANGED: included dayLabels in theme object
} as const;
