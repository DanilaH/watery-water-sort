# Evidence for 0.26 liquid seams

Capture manifests contain compositor PNG hashes/timestamps and the clean production build asset hashes. Captures were made at runtime commit cd45ce9a9538ac141e9f47398552860e87dd6db5; dirty flag reflects pending report/export-tool files, with no runtime source changes. The final APK comparison verifies the captured dist bytes.

`*-webp.json` describes lossless animated WebP export. Measured compositor timing is retained; identical frames can be merged by the encoder. No interpolation, upscaling or generated frames. Every decoded frame is pixel-identical to an original selected frame. Full animations and unmodified native-resolution PNG are delivered separately.

Both short CPU measurements are retained, including the first outlier; they are not physical Android FPS/GPU measurements.
