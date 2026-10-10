// @salon/design-tokens — semantic design tokens (CSS variables & TypeScript constants).
// Component code must reference these tokens, never hardcode hex.

export const colors = {
  primary: {
    DEFAULT: '#0d0d0d',
    foreground: '#ffffff',
    hover: '#262626',
    active: '#3a3a3a',
  },
  secondary: {
    DEFAULT: '#f2f2f2',
    foreground: '#0d0d0d',
    hover: '#e5e5e5',
    active: '#d4d4d4',
    dark: '#262626',
    darkForeground: '#ffffff',
    darkHover: '#181818',
  },
  neutral: {
    50: '#f9f9f9',
    100: '#f2f2f2',
    200: '#e5e5e5',
    300: '#d4d4d4',
    400: '#a3a3a3',
    500: '#767676',
    600: '#595959',
    700: '#404040',
    800: '#262626',
    900: '#181818',
    950: '#0d0d0d',
  },
} as const;

export const borderRadius = {
  xs: '4px',
  sm: '6px',
  md: '8px',
  input: '12px', // Balanced squircle: form fields, selects, textareas
  card: '16px', // Surface containers, panels
  modal: '24px', // Dialogs, sheets, popovers
  btn: '9999px', // Buttons, action triggers
  pill: '9999px', // Search capsules, filter tags, badges
  full: '9999px',
} as const;

export const shadows = {
  sm: '0 1px 3px 0 rgba(13, 13, 13, 0.04), 0 1px 2px 0 rgba(13, 13, 13, 0.02)',
  md: '0 4px 12px 0 rgba(13, 13, 13, 0.06), 0 2px 4px 0 rgba(13, 13, 13, 0.02)',
  lg: '0 8px 30px 0 rgba(13, 13, 13, 0.08)',
  focus: '0 0 0 2px #ffffff, 0 0 0 4px #0d0d0d',
} as const;
