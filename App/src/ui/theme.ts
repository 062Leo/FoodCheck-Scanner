/**
 * Design tokens. Values consolidate the palette the app already used (dark Material
 * greys, green accent, traffic-light colours); components must not use literals.
 *
 * Contrast (against `bg` #121212): text 18.7:1, textSecondary 10.0:1,
 * textMuted 7.0:1, accent 6.7:1. Text on filled status/accent surfaces uses the
 * matching `on*` colour (all >= 4.5:1).
 */
export const colors = {
  bg: '#121212',
  surface: '#1E1E1E',
  surfaceRaised: '#262626',
  surfaceSunken: '#0A0A0A',
  border: '#2E2E2E',
  borderStrong: '#404040',

  text: '#FFFFFF',
  textSecondary: '#BDBDBD',
  textMuted: '#9E9E9E',

  accent: '#4CAF50',
  onAccent: '#0B1F0C',
  accentSubtle: '#1A2E1A',
  /** Translucent fill for selections drawn on photos. */
  selectionFill: 'rgba(76,175,80,0.15)',

  danger: '#EF5350',
  dangerSubtle: '#3A1D1D',
  warning: '#FFC107',
  info: '#64B5F6',
  favorite: '#FFD54F',

  status: {
    OK: '#4CAF50',
    Warning: '#FFC107',
    Critical: '#EF5350',
    Unknown: '#9E9E9E',
  },
  /** Filled status surfaces (hero banner) and their text colour. */
  statusSolid: {
    OK: '#43A047',
    Warning: '#FFB300',
    Critical: '#C62828',
    Unknown: '#424242',
  },
  onStatusSolid: {
    OK: '#0B1F0C',
    Warning: '#1F1600',
    Critical: '#FFFFFF',
    Unknown: '#FFFFFF',
  },

  nova: {
    1: '#4CAF50',
    2: '#8BC34A',
    3: '#FFC107',
    4: '#EF5350',
  } as Record<number, string>,
  onNova: '#121212',

  nutriScore: {
    a: '#038141',
    b: '#85BB2F',
    c: '#FECB02',
    d: '#EE8100',
    e: '#E63E11',
  } as Record<string, string>,
  /** Text on Nutri-Score colours (dark on the light middle grades). */
  onNutriScore: {
    a: '#FFFFFF',
    b: '#121212',
    c: '#121212',
    d: '#121212',
    e: '#FFFFFF',
  } as Record<string, string>,

  scrim: 'rgba(0,0,0,0.6)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const typography = {
  caption: { fontSize: 12, lineHeight: 16 },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600' as const },
  body: { fontSize: 15, lineHeight: 21 },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: '600' as const },
  subtitle: { fontSize: 17, lineHeight: 22, fontWeight: '600' as const },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '700' as const },
  headline: { fontSize: 26, lineHeight: 32, fontWeight: '800' as const },
  sectionLabel: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
} as const;

/** Minimum size of anything tappable (Android guideline: 48 dp). */
export const TOUCH_TARGET = 48;
