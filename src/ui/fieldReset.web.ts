import { TextStyle } from 'react-native';

/**
 * The frame a browser draws round a focused field, taken off.
 *
 * `react-native-web` gives every `TextInput` a base style that resets the
 * border, the background and the native appearance, and says nothing at all
 * about the outline — the word appears nowhere in its `dist` but in the
 * validator. So Chrome paints its own focus ring: a square-cornered rectangle
 * inset over the whole field, in a blue no theme here owns. The note sheet
 * opens with the field focused, so it is a box round the note from the moment
 * the card arrives, drawn by nothing in this codebase.
 *
 * Why it takes two properties is the part worth writing down. `outlineWidth: 0`
 * alone does not remove it: the ring is `outline-style: auto`, and an auto
 * outline is the browser drawing a mark of its own rather than a line of the
 * width it was handed — Chrome keeps painting it at any width. Naming a real
 * style is what takes the decision back, and a solid outline no pixels wide is
 * nothing. Measured in headless Chrome rather than reasoned about, because the
 * two readings look equally plausible written down.
 *
 * The one-line `outline` would also do it and is refused: `validate.js` drops
 * the shorthand and asks for long-form properties. Both longhands are in React
 * Native's own style types, so this typechecks against the same `TextStyle` the
 * empty native twin is annotated with.
 */
export const fieldReset: TextStyle = {
  outlineStyle: 'solid',
  outlineWidth: 0,
};
