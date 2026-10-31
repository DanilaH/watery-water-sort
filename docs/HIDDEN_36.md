# Hidden layers · 0.36

Six levels extend the campaign to 40 / 120 stars: four selective hidden-mask puzzles, then a mini buffer and one large goal. Existing 34 layouts, IDs and star thresholds remain unchanged. This finishes the planned mechanics sequence; next work should focus on campaign pacing and phone playtesting.

## Player rules

- The initial uppermost colour is always visible. Grey portions carry one question mark each. A pour still transfers the maximal contiguous same-colour group.
- Transferred portions, the newly exposed top and all portions of a completed vessel are learned. Liquid identities follow the original units through pours, not destination coordinates.
- Undo restores board and scored move count while retaining learned colours. Restart/reselect of the same fixed puzzle also retains this memory, as does reload. Knowledge is scoped by level ID/version.
- A blind shortest forward route is not guaranteed. Free exploration plus Undo makes the exact three-star route reachable without paying for a buffer.
- While any hidden portion remains unknown, hints rank legal source/destination pairs by visible top colours, visible run lengths, vessel roles and available capacity. They describe exploration rather than promise a winning route. Full solver hints resume when all colours are known. Physics computes the actual transferred group only after the visible pair is chosen.

## Feel and compatibility

A 280 ms colour blend starts at the end of flow, retaining the existing liquid mesh, highlights, continuous volume and waves. The source receives a small ripple; a recorded water-drop cue and native 16 ms / amplitude 135 tick accompany discovery. Completion/ice takes priority over the extra cue. Reduced motion reveals immediately at receive. Interruption clears pending effects and never replays them on return.

Saves retain only discovered authored masked IDs. Replay validates required discoveries and liquid state; additional valid discoveries can come from undone routes. Their complete provenance cannot be reconstructed from shortened history. They do not change legal moves or invent scores. Ordinary saves and role mechanics retain their previous format.

## Validation

The independent C++ optimum search and separate Python bounded proof cover both buffer configurations of all 40 levels. Hidden masks do not alter physical rules, so no new solver state is needed. Core and browser tests cover unit identity, exposure, completion disclosure, Undo/restart/reload, invalid memory, visible-only hints, reward, reduced motion and the two combinations at three screen sizes.

Release evidence, source commit, CI result and APK/capture matching are recorded in `docs/audits/hidden-36/validation.json` after packaging. Native tactile feel still requires a physical Android device.
