/**
 * A type for one React Native internal, so `origin.test.ts` can check our
 * `transformOrigin` against the parser that actually reads it rather than
 * against a copy of its regex that could drift.
 *
 * Reaching into `react-native/Libraries` is not a habit worth forming — these
 * paths carry no compatibility promise and no `.d.ts`. It is worth it exactly
 * once here, because the bug this guards is invisible: no error, no warning, no
 * layout change, and it does not reproduce in the web preview. A test that
 * re-implemented the regex would pass forever while the real parser changed
 * underneath it, which is the one outcome that would make the test worse than
 * nothing.
 */
declare module 'react-native/Libraries/StyleSheet/processTransformOrigin' {
  export default function processTransformOrigin(
    transformOrigin: string | Array<string | number>
  ): Array<string | number>;
}
