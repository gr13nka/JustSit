import appJson from '../../../app.json';
import { DEFAULT_THEME, THEMES } from '../themes';

/**
 * The one sanctioned copy of a hex literal outside themes.ts.
 *
 * app.json is read by the native build, not by the bundle, so it cannot import
 * the palette — the splash screen and the Android icon background have to spell
 * paper out. If they drift, the app opens on one colour and repaints to another
 * in front of the user, which is the loudest thing a quiet app could do.
 *
 * Only the default theme can be pinned this way. A native splash is chosen
 * before any JavaScript runs, so it cannot know which theme is stored: someone
 * who has switched away from Ink gets one repaint at launch, and the three
 * papers are close enough to each other that it reads as the splash lifting
 * rather than as a flash. Making it exact would mean writing the choice
 * somewhere the native side can read, which is a lot of machinery for a frame.
 */
describe('app.json', () => {
  const paper = THEMES[DEFAULT_THEME].color.paper;

  it('splashes on paper', () => {
    expect(appJson.expo.splash.backgroundColor).toBe(paper);
  });

  it('backs the Android icon with paper', () => {
    expect(appJson.expo.android.adaptiveIcon.backgroundColor).toBe(paper);
  });
});
