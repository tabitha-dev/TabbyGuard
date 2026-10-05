import type { CheckType, ViewportName } from '../schemas/test-plan.js';

export type RiskRule = {
  name: string;
  patterns: RegExp[];
  patchPatterns?: RegExp[];
  surface: string;
  viewports: ViewportName[];
  checks: CheckType[];
  reason: string;
  selectors?: string[];
  routeHints?: string[];
};

export const riskRules: RiskRule[] = [
  {
    name: 'navigation',
    patterns: [/nav/i, /navbar/i, /header/i, /menu/i, /drawer/i, /sidebar/i],
    patchPatterns: [/aria-expanded/i, /navigation/i, /menu/i],
    surface: 'Navigation',
    viewports: ['mobile', 'desktop'],
    checks: ['interaction', 'keyboard', 'layout', 'accessibility', 'runtime'],
    reason: 'Navigation changes can affect responsive layout, focus, keyboard behavior, and accessible controls.',
    selectors: ['button[aria-expanded]', 'button[aria-label*="menu" i]', 'button[title*="menu" i]', '[role="button"][aria-expanded]']
  },
  {
    name: 'forms',
    patterns: [/form/i, /input/i, /select/i, /textarea/i, /checkout/i, /signup/i, /login/i, /auth/i],
    patchPatterns: [/<form/i, /type=["']submit/i, /onSubmit/i, /aria-invalid/i],
    surface: 'Form flow',
    viewports: ['mobile', 'desktop'],
    checks: ['interaction', 'keyboard', 'accessibility', 'runtime'],
    reason: 'Form changes can break labels, focus order, validation, and runtime behavior.',
    selectors: ['input:not([type="hidden"]):not([disabled])', 'textarea:not([disabled])', 'select:not([disabled])', 'button[type="submit"]:not([disabled])'],
    routeHints: ['checkout', 'signup', 'login', 'auth']
  },
  {
    name: 'dialogs',
    patterns: [/modal/i, /dialog/i, /popover/i, /tooltip/i, /toast/i, /overlay/i],
    patchPatterns: [/role=["']dialog/i, /aria-modal/i, /Escape/i],
    surface: 'Dialog or overlay',
    viewports: ['mobile', 'desktop'],
    checks: ['interaction', 'keyboard', 'accessibility', 'layout'],
    reason: 'Overlay changes can regress visibility, Escape behavior, focus, layering, and accessible names.',
    selectors: ['[role="dialog"]', 'dialog', '[aria-modal="true"]']
  },
  {
    name: 'theme',
    patterns: [/dark/i, /theme/i, /color/i, /tokens/i, /tailwind/i, /\.css$/i, /\.scss$/i, /\.sass$/i],
    patchPatterns: [/color:/i, /background/i, /@media/i, /grid/i, /flex/i],
    surface: 'Theme and visual system',
    viewports: ['mobile', 'desktop'],
    checks: ['accessibility', 'layout'],
    reason: 'Theme and CSS changes can introduce contrast, clipping, and responsive regressions.'
  },
  {
    name: 'layout',
    patterns: [/layout/i, /grid/i, /container/i, /section/i, /card/i, /hero/i, /page/i],
    patchPatterns: [/width:/i, /min-width/i, /max-width/i, /position:/i, /overflow/i],
    surface: 'Page layout',
    viewports: ['mobile', 'desktop'],
    checks: ['layout', 'runtime'],
    reason: 'Layout changes can cause clipping, overflow, or runtime problems across viewports.'
  },
  {
    name: 'data-state',
    patterns: [/loading/i, /skeleton/i, /spinner/i, /state/i, /store/i, /query/i, /api/i, /fetch/i],
    patchPatterns: [/fetch\(/i, /axios/i, /useQuery/i, /throw new Error/i],
    surface: 'Data and loading state',
    viewports: ['desktop'],
    checks: ['runtime', 'network'],
    reason: 'Data-flow changes can produce runtime exceptions, failed requests, and broken loading states.'
  }
];
