import { useSettings } from '../store';
import { Palette, THEMES } from './themes';

/**
 * The live palette.
 *
 * Colour is the one part of the kit that is no longer a constant, so it is read
 * through a hook rather than imported. Everything else in `tokens.ts` — space,
 * radius, the border weight, the corner generator — is the same in every theme
 * and stays a plain import.
 *
 * The theme is settings, not a context: `useSettings` is already reactive and
 * already the app's single source of runtime state, so a provider would be a
 * second copy of an answer the store can give directly.
 *
 * Structural styles belong in a module-level `StyleSheet.create` as before;
 * only the colour props move to an inline style fed by this hook. A sheet is
 * frozen at import, and a theme that could not repaint it would be a theme in
 * name only.
 */
export function useColor(): Palette {
  return THEMES[useSettings().theme].color;
}
