# Glass 0.27 evidence

Runtime release capture: 7bf33167d33d8b0ee0b35f38d0f2f1db0cc95619, clean source tree. Three actual Chromium compositor PNG recordings: layers, separate colour completion, and giant goal (ordinary vessels use the new material; the goal remains vector).

Before: actual 0.26 recording at cd45ce9a9538ac141e9f47398552860e87dd6db5. Independent captures, not synchronized frames. Comparison crop is [0,150,390,390], with measured compositor timing, no resize, interpolation or fake animation. GIF uses a global 256-colour palette including reserved cork/highlight accents; native PNG has no palette restriction.

Build provenance: generated source SHA and crop metadata in public/art/glass/material-27.json; original built-in generation prompt in prompt.txt. Generated source PNG remains outside the shipped bundle; only two lossless WebP sprites are shipped. Pixel-exact crop/decode was checked by build-glass-27.py.

cpu.json is the final short Scene.update CPU-only desktop Chromium DPR 3 sample; cpu-pre-cache-fix.json is an earlier isolated diagnostic. Neither is Android GPU/FPS evidence. Viewport report uses the final production build after fixing restoration of the cached pose. Raw screenshots remain inspection intermediates.
