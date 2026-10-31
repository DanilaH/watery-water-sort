# Ice release — revision 0.35

`src/audio/ice.ts` embeds a Vorbis buffer assembled from the existing CC0 recorded glass landing sample. `tools/build-ice-audio.py` uses seven short faded grains at different rates, high/low-pass filtering and a final decay; no oscillators or generated noise. It is one owned voice in the existing four-voice budget and stops with all other cues. Source/output hashes and decoded peak/RMS/duration: `docs/audits/ice-35/audio.json`. This is a processed glass fracture texture, not a claim that the original recording was actual ice. Listening on a physical phone remains unverified.

# Current bank — revision 0.16

Completion/victory no longer use the rejected Kenney pluck. `complete.ogg`, `cork.ogg`, `victory.ogg` and new `collect.ogg` are built from the following **Vehicle / Jan Schupke — Tinysized SFX, CC0** originals (source/license link below, reconfirmed 2026-10-28):

- `bottle-glass-cork-01.wav`: actual closure for the seating cork;
- `bottle-glass-uncork-01.wav`: air release/pop in the victory;
- `water-vial-fill-01.wav`, `water-drop-03.wav`: filled colour and fountain splash;
- `coinflip-01.wav`: short physical arrival tick for each collected star.

Reproduce with `python tools/build-material-audio.py /path/to/sfx-cc0`. The script selects recording segments, filters rumble/harsh highs, layers water/air with short recorded reflections, limits/fades and encodes Vorbis. It uses no generated oscillators/noise or pitched pluck chord. `public/audio/material-report.json` records SHA-256 of the original WAVs and final files, and **decoded** peak/RMS/duration. Historical `mix-report.json` describes unchanged older edits, not the replacement files. Hint still uses the previous sampled pluck. Four-voice ownership/mute/background behavior is preserved. Subjective listening on a real phone remains unverified.

The source archive is not bundled; the generator accepts the explicitly named CC0 originals from the documented download. No Magic Sort audio was extracted or reused.

---

# Audio sources — revision 0.2

The rejected 0.1 oscillator/noise synthesizer has been removed. Runtime audio uses bundled Vorbis samples. No external audio service or runtime downloads are required. Muting/background interruption stops all owned voices. Maximum four simultaneous voices.

## Original recordings and licenses

**Vehicle / Jan Schupke — Fantasy Sound Effects (Tinysized SFX)**

- Source: https://opengameart.org/content/fantasy-sound-effects-tinysized-sfx
- Download: https://opengameart.org/sites/default/files/tinysized.zip
- License: CC0 1.0, explicitly declared on the source page; checked 2026-10-23.
- Original files used: `sfx-cc0/water-pour-01.wav`, `sfx-cc0/water-vial-fill-01.wav`, `sfx-cc0/water-drop-02.wav`, `sfx-cc0/vial-glass-close-01.wav`.
- Uses: three water-flow variations, selection droplet, glass landing.

**Kenney — Interface Sounds**

- Source: https://kenney.nl/assets/interface-sounds
- Download: https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip
- License: CC0 1.0, declared on source page and bundled License.txt; checked 2026-10-23.
- Original files used: `Audio/pluck_001.ogg`, `Audio/back_001.ogg`.
- Uses: sampled pluck for color completion/hint/victory; soft rejection.

CC0 terms: https://creativecommons.org/publicdomain/zero/1.0/

## Editing and mix

`tools/build-audio.py` reproduces edits from the named extracted originals. Requires ffmpeg, NumPy and SciPy. Edits: mono/44.1 kHz, selected short segments, 100–5200 Hz filtering, soft transient limiting, attack/release fades, modest room tail and pitch arrangement of sampled plucks. Stream alternatives are from different recording regions, selected without consecutive repeats, with bounded playback-rate variation. Fast animation trims the stream with a release envelope instead of leaving a sound after the stream stops.

`public/audio/mix-report.json` contains per-asset duration, peak, RMS and byte count. Decoded Vorbis output is checked separately in browser tests. Numerical checks do not establish pleasantness or listening fatigue. Physical speaker/headphone listening remains necessary; do not label this mix user-approved in advance.

BMacZero bubble recordings were evaluated as candidates but are not included in the runtime mix. Freesound candidates were not downloaded or used. No competitor assets were copied.

## Revision 0.10

Added `accept.ogg` (75 ms) and `cork.ogg` (120 ms) from the same CC0 `vial-glass-close-01.wav`, using recording segments 25–100 ms and 95–215 ms. Existing nine recordings remain unchanged. Runtime acceptance is trimmed to 65 ms, landing to 115 ms, cork to 105 ms. A low-pass sweep maps water to the recipient's current/final fill, and the stream release follows the remaining flow phase. Color/victory combine a quiet glass closure and the existing sampled tonal accent; voice limit remains four. No generated oscillator/noise synthesis was introduced. Pleasantness remains subject to physical listening.
