import { IBMPlexMono_400Regular } from '@expo-google-fonts/ibm-plex-mono/400Regular';
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono/500Medium';
import { IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono/600SemiBold';
import { Newsreader_400Regular } from '@expo-google-fonts/newsreader/400Regular';
import { Newsreader_400Regular_Italic } from '@expo-google-fonts/newsreader/400Regular_Italic';

/**
 * The exact faces loaded at startup. Keys are the strings used as `fontFamily`
 * in `typography.ts` — the two files must stay in step.
 *
 * Imported by subpath, not from the package root: the root index.js `require`s
 * every weight, so `import { X } from '@expo-google-fonts/newsreader'` bundles
 * all 14 faces (~1.6MB) to use one. Subpaths pull only the .ttf named.
 *
 * Kept separate from `typography.ts` so unit tests can import the type scale
 * without dragging font binaries through the module graph.
 */
export const fontAssets = {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
  Newsreader_400Regular,
  Newsreader_400Regular_Italic,
};
