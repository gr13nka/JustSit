import { TextStyle } from 'react-native';

import { color } from './tokens';

/**
 * Two faces, with a hard boundary between them.
 *
 * MONO carries everything structural — timer digits, nav, labels, stats, buttons.
 * SERIF carries the teaching card body and nothing else. A paragraph of Wallace
 * set in mono reads like a terminal; in serif it reads like a book being handed
 * to you. That switch is doing real emotional work, so it must not leak.
 */
export const font = {
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
  monoSemiBold: 'IBMPlexMono_600SemiBold',
  serif: 'Newsreader_400Regular',
  serifItalic: 'Newsreader_400Regular_Italic',
} as const;

/**
 * The full type scale. Screens compose from these rather than declaring
 * fontSize/fontFamily inline, so the voice of the app stays in one file.
 */
export const type = {
  /** App name on the welcome screen. Wide, quiet, architectural. */
  display: {
    fontFamily: font.monoMedium,
    fontSize: 26,
    letterSpacing: 6,
    color: color.ink,
  },

  /** Screen headers — "Your garden", "Session". */
  title: {
    fontFamily: font.monoMedium,
    fontSize: 16,
    letterSpacing: 0.4,
    color: color.ink,
  },

  /** The countdown. The largest thing in the app, and deliberately plain. */
  timer: {
    fontFamily: font.mono,
    fontSize: 56,
    letterSpacing: 2,
    color: color.ink,
  },

  /** Big numbers on stat cards. */
  stat: {
    fontFamily: font.mono,
    fontSize: 30,
    color: color.ink,
  },

  /** Small uppercase labels — "CURRENT STREAK", "STAGE ONE". */
  label: {
    fontFamily: font.monoMedium,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: color.inkSoft,
  },

  body: {
    fontFamily: font.mono,
    fontSize: 14,
    lineHeight: 22,
    color: color.ink,
  },

  caption: {
    fontFamily: font.mono,
    fontSize: 12,
    lineHeight: 18,
    color: color.inkSoft,
  },

  button: {
    fontFamily: font.monoMedium,
    fontSize: 15,
    letterSpacing: 0.6,
  },

  /** Teaching card body. The only serif in the app. */
  teaching: {
    fontFamily: font.serif,
    fontSize: 20,
    lineHeight: 32,
    color: color.ink,
  },
} satisfies Record<string, TextStyle>;
