import { TextStyle } from 'react-native';

import { color } from './tokens';

/**
 * Two faces, with a hard boundary between them.
 *
 * M PLUS Rounded 1c carries everything a user reads: timer, nav, labels, stats,
 * buttons, and the teaching card. Its soft terminals keep even the clinical
 * copy from sounding severe, which is the whole reason it is here.
 *
 * Shantell Sans is a voice, not a reading face. It is for short felt lines —
 * the app name, a caption under the cat, an onboarding tagline — one line at a
 * time. A paragraph set in it stops being warm and starts being hard to read.
 */
export const font = {
  sans: 'MPLUSRounded1c_400Regular',
  sansMed: 'MPLUSRounded1c_500Medium',
  sansBold: 'MPLUSRounded1c_700Bold',
  hand: 'ShantellSans_400Regular',
} as const;

/**
 * The full type scale. Screens compose from these rather than declaring
 * fontSize/fontFamily inline, so the voice of the app stays in one file.
 */
export const type = {
  /** App name on the welcome screen — a scrawled logo, not a heading. */
  display: {
    fontFamily: font.hand,
    fontSize: 32,
    color: color.ink,
  },

  /** Screen headers — "Your garden", "Session". */
  title: {
    fontFamily: font.sansBold,
    fontSize: 18,
    lineHeight: 23,
    color: color.ink,
  },

  /** The countdown. The largest thing in the app, and deliberately plain. */
  timer: {
    fontFamily: font.sans,
    fontSize: 56,
    letterSpacing: 0,
    color: color.ink,
  },

  /** Big numbers on stat cards. */
  stat: {
    fontFamily: font.sansBold,
    fontSize: 26,
    lineHeight: 33,
    color: color.ink,
  },

  /** Small uppercase labels — "CURRENT STREAK", "STAGE ONE". */
  label: {
    fontFamily: font.sansMed,
    fontSize: 13,
    lineHeight: 17,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: color.inkSoft,
  },

  body: {
    fontFamily: font.sansMed,
    fontSize: 15,
    lineHeight: 23,
    color: color.ink,
  },

  caption: {
    fontFamily: font.sansMed,
    fontSize: 13,
    lineHeight: 18,
    color: color.inkSoft,
  },

  button: {
    fontFamily: font.sansBold,
    fontSize: 15,
    letterSpacing: 0.2,
    color: color.ink,
  },

  /** Teaching card body — the long-form 400 weight, set airier than body. */
  teaching: {
    fontFamily: font.sans,
    fontSize: 18,
    lineHeight: 28,
    color: color.ink,
  },

  /** A single felt line — a caption beside Батон, the onboarding tagline. */
  hand: {
    fontFamily: font.hand,
    fontSize: 18,
    lineHeight: 25,
    color: color.ink,
  },
} satisfies Record<string, TextStyle>;
