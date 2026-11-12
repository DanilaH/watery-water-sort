# Agent contract — Сортировка воды

Read README.md, docs/PROJECT_DECISIONS.md and the most recent campaign/QA evidence. Current README describes debug/demo ads and store acceptance as incomplete.

This is an Android/RuStore-oriented game, **not a Yandex Games web SDK project**. Keep its core rules, existing game feel, actual saved progression, reward authority, offline play and lifecycle independent of presentation or advertisement callbacks. Do not add directors, currencies, redirections, ad frequency changes or new content because a research document mentions them. Verify actual app/version/source, user decisions and device evidence before changing code.

## mini-games-kit: task-routed research and reference teardown

For every substantial task open docs/kit-guidance/TASK_ROUTER.md; choose only 1–2 applicable studies. When the request includes a competitor, screenshot, game-video, GIF, UX parity or reference feel, first follow docs/kit-guidance/REFERENCE_PROTOCOL.md. State which frames/gestures were truly inspected, what was inferred and which source was inaccessible.

Guidance snapshot: e2382670fbd5c2aa76462fea688c60de2b067392. This repo's actual runtime mini-games-kit dependency, if any, is separate and must never be silently upgraded. For shared code inspect the API **at the installed runtime version** and reuse existing proven primitives. Browser CI, synthetic gestures and demo ads do not prove native phone feel, live monetization or player retention.

At the end of a material change report KIT IMPACT: NONE / REUSE / IMPROVE / CANDIDATE / EXTRACTED, with evidence and targeted upstream proposal for reusable fixes (docs/kit-guidance/KIT_FEEDBACK_LOOP.md). Do not automatically change other game repos, publish to a store or replace project source-of-truth.
