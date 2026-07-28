/**
 * The single source of colour, spacing and shape for the whole app.
 * No hex literal should appear anywhere else in the codebase.
 */

/**
 * Colour has exactly one job here:
 *   terracotta = you can touch this
 *   sage       = something grew
 * Nothing else may use either. Everything structural is paper and ink.
 *
 * Plants ship as PNGs and cannot be tinted in code, so they carry whatever
 * colours they were drawn in — `sage` is a UI accent only, never a plant colour.
 */
export const color = {
  paper: '#F7F1E5',
  paperDeep: '#EFE7D8',
  line: '#E2D8C6',
  ink: '#2B2521',
  inkSoft: '#7D746A',
  terracotta: '#C8722F',
  sage: '#6E7C52',
} as const;

export type ColorName = keyof typeof color;

/** 4pt base. Prefer whitespace over dividers — this app should breathe. */
export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export const radius = {
  card: 12,
  button: 24,
  pill: 999,
} as const;

/** Hairlines are always 1px in `color.line`. */
export const hairline = 1;
