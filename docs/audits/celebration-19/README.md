# Celebration 0.19 evidence

Runtime source: `ef821255cd092cfe25f99a65e31014cf8ce3b812`.

`capture.json` records 16 production screenshots, three phone viewports and all 23 production asset hashes. Four selected captures are retained as WebP. `victory-motion.gif` packages 32 actual browser screenshots of the result area, including the letter entrance and idle motion; `motion.json` records the real frame timestamps. It is silent and does not demonstrate Android haptics. Reproduction: `tools/capture-feel-19.mjs`, `tools/capture-victory-motion-19.mjs` and `tools/pack-victory-motion-19.py`.

`render.json` is a headless eight-colour CPU diagnostic at DPR 2, normal speed and ×4 CPU throttling. It measures the scene update, including screen-wide particles; CSS compositor/GPU presentation and real phone FPS are outside this measurement.

Physical haptic strength, subjective audio playback and installation still need a phone playtest.

The capture directory also contained five obsolete outputs from overlapping intermediate builds; they are identified as unreferenced in the manifest. A clean final build reproduced the APK assets exactly. `apk.json` and `release.json` record the verified package and CI identity.
