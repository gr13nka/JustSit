/**
 * The pen everything drawn in this app is drawn with: stroke only, round nib,
 * nothing filled.
 *
 * One hand, two nibs. `PEN_DOODLE` writes on the 48-unit canvas the plants and
 * the icons share; `PEN_HERO` writes on the 200-unit canvas of the heroes.
 *
 * The hero nib is not the doodle nib scaled with its canvas — that would be
 * nearly 12 units, and a hero is drawn at 200pt across, where such a line is a
 * marker rather than a pen. It is deliberately finer relative to what it draws,
 * which is what keeps a plant and a sleeping cat reading as the same hand at
 * very different sizes.
 *
 * The wobble lives in the path data and nowhere else. A mark that re-rolled
 * itself between frames would read as a glitch rather than as a hand, so no
 * drawing in this app is ever generated at runtime.
 *
 * There is a third tier that does not use either nib: the hand-drawn marks in
 * the interface — the divider, the tab scribble, the timer ring — draw at
 * hairline to 2 on their own tight canvases, where a nib meant for a figure
 * would be a stroke through the layout rather than a mark beside it.
 */

/** Plants, doodle icons — the 48-unit canvas. */
export const PEN_DOODLE = {
  fill: 'none',
  strokeWidth: 2.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

/** Батон, the sitting figure — the 200-unit canvas. */
export const PEN_HERO = {
  fill: 'none',
  strokeWidth: 7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;
