/**
 * Design tokens lifted from the original Mandi Bhai prototype
 * (Mandi Bhai.dc.html) so the app matches the approved design.
 */
export const colors = {
  // Surfaces
  bg: '#FBF7EF',
  card: '#FFFFFF',
  sunken: '#F1ECE0',
  rail: '#EFE8DA',

  // Brand
  navy: '#15265E',
  navySoft: '#2946A6',
  primary: '#FF5436',
  primarySoft: '#FFE9E3',
  primaryDark: '#E23B1E',
  amber: '#FFB43D',

  // Accents
  blue: '#2456E6',
  blueSoft: '#E7EDFD',
  green: '#12A36B',
  greenDark: '#0E8A5A',
  greenSoft: '#DCF3E9',
  warn: '#E8930B',
  warnSoft: '#FFF1D6',

  // Text
  text: '#191723',
  textMuted: '#6B6577',
  textFaint: '#9A93A6',
  textGhost: '#A49EAF',
  onNavy: '#B4C4F2',
  onNavyFaint: '#8DA0D8',

  // Lines
  border: '#F0EADE',
  borderStrong: '#EDE7DA',
  divider: '#F6F0E4',
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 999,
} as const;

export const spacing = (n: number) => n * 4;

/**
 * The prototype uses Baloo 2 for display text and Nunito for body. Rather
 * than pull in font files, we lean on weight + letter-spacing to get a
 * similar feel from the system font stack.
 */
export const type = {
  display: { fontWeight: '800' as const, letterSpacing: -0.3 },
  heading: { fontWeight: '700' as const },
  body: { fontWeight: '600' as const },
  strong: { fontWeight: '800' as const },
};

export const shadow = {
  card: {
    shadowColor: '#1E1446',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  raised: {
    shadowColor: '#FF5436',
    shadowOpacity: 0.32,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
};
