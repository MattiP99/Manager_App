export const Colors = {
  canvas: '#DDD0C8',
  surface: '#FFFFFF',
  ink: '#323232',
  inkMuted: '#7A6659',
  hairline: '#E6DFCF',
  accent: '#96C2DB',
  success: '#15803D',
  successBg: '#DCFCE7',
  warning: '#B45309',
  warningBg: '#FEF3C7',
  error: '#DC2626',
  errorBg: '#FBE4E4',
} as const;

export const Fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
} as const;

export const Typography = {
  title: { fontFamily: Fonts.semiBold, fontSize: 22, lineHeight: 28 },
  subtitle: { fontFamily: Fonts.semiBold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: Fonts.regular, fontSize: 15, lineHeight: 21 },
  bodyBold: { fontFamily: Fonts.semiBold, fontSize: 15, lineHeight: 21 },
  small: { fontFamily: Fonts.regular, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: Fonts.medium, fontSize: 12, lineHeight: 16 },
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const Radii = {
  sm: 8,
  md: 12,
  pill: 999,
} as const;
