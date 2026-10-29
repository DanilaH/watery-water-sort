# Crystal pedestal 0.20

The approved simpler generated artwork replaces the seven procedural diamond shapes under the large goal. The final transparent artwork is in `public/art/goal-crystal-base.webp`; the source image SHA, transparent crop and prepared asset hashes are recorded in `public/art/goal-crystal.json`. Preparation only crops alpha padding, downsamples and partitions the approved artwork. It does not redraw the artwork or alter its colours.

Five complementary fracture textures use pixels from the same illustration. They share the same canvas/origin, so the break retains the original facets instead of turning into unrelated squares. The base sits behind the glass, its central seat aligned to the rounded bottom. Size respects the left/right field edges and available space below; tube layout and touch targets do not change.

At visual completion the base flashes briefly, then splits into five rotating/falling fragments and fades within 650 ms. Saved complete goals do not replay the break or restore the base. Undo restores the pedestal with the unfinished goal. Reduced motion fades the complete sprite with no flying pieces. Navigation/reset hides the sprite set. The image is updated independently of the cached glass commands.

The preparation script is `tools/build-crystal-assets.py`; it takes the approved transparent PNG. The selected generated source was `exec-13fd9ef4-3440-4e41-9695-a5e9e9421e8c.png`, not the earlier more realistic concept. The six lossless WebP textures total about 194 KB. Rules, levels, stars, sounds, haptic timing and save schema are unchanged.

## Why the competitor's liquid looks punchier

Comparison sources: existing user-video captures in `docs/audits/magic-sort-16/color.webp` and `giant.webp`, and our actual renderer in `src/game/WaterScene.ts`. No new playback or competitor implementation access is claimed.

The competitor frames show a darker field, purer primary red/yellow/blue and relatively uniform coloured interiors. Our palette includes a pink-red, amber and lighter blue; our volume shading mixes navy into the edges (up to roughly 20%) and white into the highlight (up to 13%). Broad pale shading and the brighter blue field soften the overall contrast. Our liquid polygons are already opaque; transparency is not the explanation.

A subsequent colour-material pass should test cleaner saturated hues, a narrower highlight and more restrained edge shading against all four themes and colour-symbol mode. This release integrates the approved pedestal; it preserves the existing liquid palette and shading.

Release verification: 35 core tests, 129 browser scenarios and 32 independently verified optimal paths passed. CI: https://github.com/DanilaH/watery-water-sort/actions/runs/40941793693 . APK code 20 / `0.20.0-crystal`, package `com.danilah.waterywatersort.preview3`, 10,125,119 bytes, SHA-256 `710684545fb07a4711360a285b4727af4af0b29ee52b323e77ff1ae156bd6744`. Preview certificate, RSA v2 signature/protected content, tamper rejection, ZIP CRC and all 30 production files (including six crystal textures and 12 OGGs) were verified. Captured asset hashes match the APK. Evidence: `docs/audits/crystal-20/`.
