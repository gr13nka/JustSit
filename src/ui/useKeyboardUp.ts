import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Whether the keyboard is up.
 *
 * A boolean and not a height, because the height is the one thing nothing here
 * has to know: `KeyboardAvoidingView` measures the lift from geometry — the
 * overlap between its own frame and the keyboard's — which is the only reading
 * that comes out the same on both platforms, since an Android keyboard reports
 * a height that does not count the navigation bar it stands on. What geometry
 * cannot answer is *whether*, and that is asked because the keyboard standing
 * on the navigation bar is also the keyboard covering it: a bottom safe-area
 * inset held for that bar while the keyboard is up is room that no longer
 * exists, reserved twice.
 *
 * Focus is not this question. A field keeps the caret when the keyboard is put
 * away — the Android back key does exactly that, and RN 0.86's `ReactEditText`
 * has no `onKeyPreIme` override to tell anybody it happened — so a screen
 * watching `onFocus`/`onBlur` goes on believing the keyboard is there after it
 * has gone.
 *
 * On web `react-native-web`'s `Keyboard` is a stub whose listeners never fire,
 * so this is permanently false. That is the right answer for a browser, where
 * the keyboard is the machine's and takes no room from the page.
 */
export function useKeyboardUp(): boolean {
  const [up, setUp] = useState(() => Keyboard.isVisible());

  useEffect(() => {
    // Written out as two lists rather than as one pair of variable event names,
    // so `addListener`'s generic still resolves to a literal event.
    //
    // iOS announces the keyboard before it animates, so the card moves with it
    // rather than after it; Android has only the `did` pair to offer.
    const subscriptions =
      Platform.OS === 'ios'
        ? [
            Keyboard.addListener('keyboardWillShow', () => setUp(true)),
            Keyboard.addListener('keyboardWillHide', () => setUp(false)),
          ]
        : [
            Keyboard.addListener('keyboardDidShow', () => setUp(true)),
            Keyboard.addListener('keyboardDidHide', () => setUp(false)),
          ];
    return () => subscriptions.forEach((s) => s.remove());
  }, []);

  return up;
}
