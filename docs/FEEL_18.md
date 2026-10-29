# Feel pass 0.18

Scope: seven phone-playtest findings plus insufficient haptic strength. Puzzle rules, level bank, ratings and persisted progress stay unchanged.

## Filled bottle

The receiver still rewards at visual fill, without waiting for the returning source. Its presentation now lasts 900 ms with beats at 0, 260 and 570 ms: fill accent, rising wrap, cork contact. Each phase has an immediate haptic event. Reusing a vessel cancels its unfinished completion, including later contact. Choosing and releasing a vessel both disturb the upper liquid surface through the existing damped wave renderer.

## Victory

After the final receiver finishes its three beats, filled vessels pop in reading order (row, then horizontal position), 200 ms apart. Each pop has a cork sound and increasingly strong haptic event. Popped corks are tracked for the presentation lifetime; removing a finished burst cannot restore a static cork. Undo, restart, navigation, background and resizing clear the presentation.

Fountains, flying corks and 64 droplets per vessel draw in a dedicated fixed, pointer-transparent, screen-wide canvas. The puzzle canvas retains its input geometry and clipping. Upper fountains use an apex bounded below the screen's top edge; lower vessels retain taller fountains. Reduced motion uses brief stationary colour accents. The overlay is removed after expiry or interruption.

## Interface

The result uses a larger title and gold stars within its reserved row. The result never changes board height at the winning move. Dense banks preserve their previous two-row geometry and use a compact result. Large-goal instructions remain visible in words; star conditions use words instead of inequalities. The advertising vessel uses the actual ordinary vessel width, height and rounded-bottom radius instead of stretching a fixed 60×220 drawing.

## Android vibration

`FeelHaptics` uses `VibratorManager` on API 31+ and `Vibrator` below. Each visual event triggers one immediate pulse, with `VibrationEffect.createOneShot` on API 26+, and a duration fallback on older devices. Amplitude-control fallback uses the platform default amplitude. VIBRATE permission is declared. App and system touch-feedback settings, focus and background interruption are respected; disabling feedback cancels active vibration.

| Event | Duration ms | Amplitude 1–255 |
| --- | ---: | ---: |
| Select / UI | 22 | 155 |
| Collection | 15 | 125 |
| Land | 24 | 165 |
| Accepted pour | 26 | 175 |
| Fill phase 1 | 30 | 175 |
| Fill phase 2 | 40 | 210 |
| Fill phase 3 | 55 | 245 |
| Victory first | 40 | 185 |
| Victory second | 50 | 220 |
| Victory following | 65 | 255 |

These are implementation parameters, not measured motor output. Actual strength, waveform and subjective comfort require a physical-phone playtest. No claim of phone installation, subjective listening or haptic calibration is made.

API reference: https://developer.android.com/reference/android/os/VibrationEffect#createOneShot(long,int)

## Validation

Browser regression covers persisted completion, Undo, rewarded expansion, source reuse, navigation, rotation, small screens, reduced motion and star collection. Added focused checks for three phase ordering, ordered pops, permanent cork removal, full-screen overlay geometry, selection/release liquid reactions, result/control separation and effect cancellation. Production captures use actual input and elapsed animation time; finite CSS animations are completed only for screenshots.

The final pass also caches settled glass during the victory fountains, invalidating on cork-pop state, and forces a final entrance frame after a stalled initial frame. A regression checks that an advertising slot and the ordinary glass reach their actual layout position. The focused phone layout cases include the final bank and its longer result action.

An eight-colour headless CPU diagnostic (DPR 2) measured scene-update p95 of 1.8 ms normally and 8.2 ms at ×4 CPU throttling after glass caching, with a 14.7 ms maximum at ×4. This includes the overlay drawing calls; it excludes GPU/presentation and real-phone behaviour. The pre-cache diagnostic overlapped screenshot work, so its timings are not used as a controlled speedup ratio. The reproducible diagnostic is `tools/benchmark-feel-18.mjs`.
