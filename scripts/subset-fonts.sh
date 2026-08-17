#!/bin/sh
# Regenerates the Latin-subset font files in assets/fonts/ from the full
# Google-Fonts TTFs in node_modules.
#
# Why subsets exist at all: M PLUS Rounded 1c ships with CJK coverage, so each
# weight is ~3.3MB — three weights would put ~10MB of font binary in the bundle
# to set English text. Subsetting to Latin brings each face down to tens of KB.
# The app's content is English; if it ever grows Cyrillic (Батон stays a
# drawing, not a word), add U+0400-04FF below and re-run.
#
# Needs `uv` (https://docs.astral.sh/uv/) — pyftsubset is fetched ephemerally,
# nothing is installed into the project.
set -e
cd "$(dirname "$0")/.."

# Latin + Latin Ext-A + general punctuation (· … — ‘ ’ “ ”) + minus.
RANGES="U+0000-00FF,U+0100-017F,U+2000-206F,U+2212"

subset() {
  uvx --from fonttools pyftsubset "node_modules/@expo-google-fonts/$1" \
    --unicodes="$RANGES" \
    --layout-features='*' \
    --output-file="assets/fonts/$(basename "$1")"
}

subset m-plus-rounded-1c/400Regular/MPLUSRounded1c_400Regular.ttf
subset m-plus-rounded-1c/500Medium/MPLUSRounded1c_500Medium.ttf
subset m-plus-rounded-1c/700Bold/MPLUSRounded1c_700Bold.ttf
subset shantell-sans/400Regular/ShantellSans_400Regular.ttf

ls -lh assets/fonts/
