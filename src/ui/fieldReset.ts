import { TextStyle } from 'react-native';

/**
 * Nothing, because a phone draws nothing to undo.
 *
 * A focus ring is a browser's mark — the frame it puts round whatever the
 * keyboard is pointed at — and neither Android nor iOS has one. So this is not
 * a style that happens to be empty; it is the platform's honest answer.
 *
 * It exists for its `.web.ts` twin, which does have something to say. Metro
 * picks the platform file, so the native bundle never contains a line of that
 * one.
 */
export const fieldReset: TextStyle = {};
