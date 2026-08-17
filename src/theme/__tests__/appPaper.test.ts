import appJson from '../../../app.json';
import { color } from '../tokens';

/**
 * The one sanctioned copy of a hex literal outside tokens.ts.
 *
 * app.json is read by the native build, not by the bundle, so it cannot import
 * the palette — the splash screen and the Android icon background have to spell
 * paper out. If they drift, the app opens on one colour and repaints to another
 * in front of the user, which is the loudest thing a quiet app could do.
 */
describe('app.json', () => {
  it('splashes on paper', () => {
    expect(appJson.expo.splash.backgroundColor).toBe(color.paper);
  });

  it('backs the Android icon with paper', () => {
    expect(appJson.expo.android.adaptiveIcon.backgroundColor).toBe(color.paper);
  });
});
