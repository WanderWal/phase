# Phase 3D experience contract

**Status:** Proposed for epic #17972, 2026-09-29. The product direction for camera travel and a navigable world is pending. The fixed table below is a reversible implementation default, not a final art or navigation decision.

## Existing seams

[App.tsx](../client/src/App.tsx) uses `BrowserRouter`. [AppShell](../client/src/components/chrome/AppShell.tsx) keeps one atmospheric backdrop, rail, and mobile tabs mounted around the out-of-match routes. `/game/:id`, `/replay`, and `/open-desktop` sit outside that shell. Preserve these URLs, deep links, history, and session lifecycles.

| Route | Current flow | 3D contract |
| --- | --- | --- |
| `/`, `/setup`, `/multiplayer`, `/my-decks`, `/deck-builder`, `/coverage`, `/draft`, `/draft/quick`, `/draft-pod`, `/draft-spectator`, `/tournament`, `/tournament/:code` | Shell and DOM pages; home actions navigate to existing routes | One shared scene behind the shell. Route selects a camera composition or station; rail, tabs, forms, and data remain DOM. |
| `/game/:id` | [GamePage](../client/src/pages/GamePage.tsx) owns `GameProvider`, live adapters, board, HUD, and `WaitingFor` dialogs | Full-screen table scene within the existing page. Keep adapter, HUD, log, and dialog lifecycle. |
| `/replay` | [ReplayPage](../client/src/pages/ReplayPage.tsx) uses [ReplayAdapter](../client/src/adapter/replay-adapter.ts), [replayStore](../client/src/stores/replayStore.ts), shared `GameBoard`, and DOM playback controls in `spectate` mode | Reuse the table renderer for each reconstructed snapshot. Scrub/seek replaces scene state without dispatching game actions. |
| `/open-desktop` | [OpenDesktopPage](../client/src/pages/OpenDesktopPage.tsx) hands a validated `phase://open?` link to the OS and keeps browser fallbacks | Keep this page fast and DOM-first. A 3D asset or failed GPU must never delay the handoff or its fallback links. |

Browser local/AI play, online/P2P play, and Tauri desktop play already converge at the game store through their adapters. The 3D view consumes the same committed snapshot; it does not select an adapter or start a second game session. Desktop native AI can use a server sidecar, so no renderer assumption may depend on WASM.

## Camera and world decision

| Option | Interaction | Benefits | Costs |
| --- | --- | --- | --- |
| **Fixed tabletop, recommended first** | Elevated orthographic camera; bounded focus/zoom to a zone; opponents occupy stable seats | Cards stay readable; hit areas and keyboard order stay stable; replay and mobile use the same spatial map | Less sense of exploration outside matches |
| Navigable hub with table stations | Camera travels between menu, deck, draft, lobby, and match stations; route still owns page state | Stronger sense of one place across the whole app | Travel time, focus management, small-screen layout, and deep-link arrival all need separate design |
| Free-navigation world | Player controls camera/avatar and approaches objects | Maximum spatial freedom | Every action needs an equally capable non-spatial path; occlusion and motion can obscure decisions |

Start with the fixed table and route-driven shell compositions. Keep camera presets and scene placement in the presentation layer, separate from route state and game state. The table can later become one station in a navigable world without changing engine DTOs, action dispatch, replay logs, or URLs. For the first visual pass, use the existing dark shell, ember accents, card art, and restrained table materials. Mana colors should identify engine-provided game information; ambient lighting must not carry a rule or choice alone.

**Open product decisions for Lead:** (1) fixed table or navigable hub as the final primary camera; (2) station-to-station transitions or free travel outside matches; (3) whether 3D is the default on mobile or an opt-in alongside the DOM view. Resolve after the first live/replay slice is usable with keyboard and fallback. None blocks that slice.

## Renderer decision and source check

Use **React Three Fiber 9 + Three.js `WebGLRenderer` on WebGL 2** for the initial renderer. The client already has React 19 and `three` 0.184; it does not yet depend on `@react-three/fiber` ([package.json](../client/package.json)). R3F is a React renderer for Three; its official compatibility guide pairs R3F 9 with React 19 and says v10 is alpha ([R3F introduction](https://r3f.docs.pmnd.rs/)). `Canvas` creates a Three `WebGLRenderer` by default and exposes `fallback`, `dpr`, and `frameloop` ([R3F Canvas](https://r3f.docs.pmnd.rs/api/canvas)). Three's current `WebGLRenderer` requires WebGL 2; WebGL 1 support ended at r163 ([Three WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html)). Three supplies an explicit WebGL 2 capability check ([Three WebGL utility](https://threejs.org/docs/pages/WebGL.html)).

R3F owns declarative scene composition and renderer lifecycle; Three owns cameras, geometry, textures, and GPU rendering. Keep engine snapshots in the existing React/Zustand path. Do not build a parallel imperative game-state cache in Three objects. Defer WebGPU: Three describes `WebGPURenderer` as experimental and `WebGLRenderer` as the recommended choice for pure WebGL 2 apps ([Three WebGPURenderer guide](https://threejs.org/manual/pages/webgpurenderer)). Re-evaluate only after an actual renderer need and browser/desktop measurements.

## State and interaction authority

```text
Engine GameState + GameEvent + viewer-filtered ViewerInteraction
    → existing adapter → committed gameStore snapshot
    → table scene (geometry, visual motion) + DOM HUD/choices
DOM button or mesh hit → shared UI interaction handler
    → dispatchInteraction / previewInteractionResponse → adapter → engine
```

[ViewerInteraction](../crates/engine/src/types/interaction.rs) is the engine-authored, viewer-scoped contract. [derive_viewer_interaction](../crates/engine/src/game/interaction.rs) takes authoritative and filtered state: authorization comes from the former; visible objects and presentation come from the latter. It publishes `can_submit`, `availability`, opportunities with opaque IDs, exact choices or response schemas, status/rejection reasons, and attachment views. [gameStore](../client/src/stores/gameStore.ts) receives that projection with the engine snapshot; [dispatchInteraction](../client/src/game/dispatch.ts) submits an opaque `InteractionSubmission` and then commits the next snapshot. Use its preview path for engine validation during multi-step choices.

The 3D layer may decide coordinates, camera framing, hover animation, and where a DOM anchor sits. It may not derive legal actions, target sets, player authority, hidden-card identity, cost, combat outcome, zone membership, or choice validity. A mesh hit yields an object or choice ID already present in the current viewer projection; the shared handler looks up the engine-authored opportunity and routes to the existing DOM choice flow. If the projection lacks a needed affordance, extend the engine DTO through its normal review path. No card-specific client rule, duplicate rules in transport, or guessed disabled state.

Scene nodes use stable game object IDs only within the current snapshot/incarnation. A new snapshot can replace or remove a node; animation never delays that commit. Never pre-load hidden faces or place hidden text in GPU textures. Render only the viewer-visible information. On replay load, seek, unload, or live session replacement, clear transient selection, hover, motion, and any stale interaction affordance. Replay remains read-only even when a prior live session left an interaction in the store.

## Spatial and DOM behavior

- **Table:** own hand at the near edge, battlefield in the near half, stack in the center, each opponent in a stable separate seat, and library/graveyard/exile at each seat's side. Multi-opponent layouts preserve seat identity across elimination. Card enlargement uses a DOM inspection panel so Oracle text stays legible. Camera focus may magnify a zone but cannot hide the active choice or move a target under a confirmation control.
- **Pointer:** raycast identifies only the rendered object. Highlight comes from engine-published opportunities, not from a client legality check. Click/tap opens or selects the matching DOM action or choice. Background hits do nothing; clicks while a blocking dialog is open do not dispatch.
- **Keyboard and screen reader:** every actionable card, seat, zone, and response has a DOM equivalent in a stable ordered list or action tray, with visible focus, a readable name, and the engine-provided disabled/rejection reason. Canvas can be `aria-hidden` only when that DOM path is complete. Choice dialogs stay in the DOM with focus trap, Escape/cancel behavior where the engine allows it, and focus return to the initiating object. Announce committed state/turn changes from engine events; do not announce every animation frame.
- **Choice layer:** retain `GamePage`'s `WaitingFor`/`DialogHost` and modal routing while migrating each interaction to `ViewerInteraction`. Pointer and keyboard use one handler; `can_submit` and opportunity status gate submission. Frontend-authored labels use `react-i18next`; card/engine text passes through the existing content pipeline.
- **Out-of-match hub:** spatial stations are visual route links, never a second router. Keep the shell rail, mobile tabs, back behavior, setup forms, deck editing, draft picks, lobby controls, and tournament controls as DOM. Direct URLs land at the correct station without camera travel as a prerequisite.

| Station preset | Routes | Spatial cue; DOM task |
| --- | --- | --- |
| Entry table | `/`, `/setup`, `/multiplayer` | Match table and empty seats frame play/setup/lobby; existing dashboard, forms, and join controls handle action. |
| Collection workbench | `/my-decks`, `/deck-builder`, `/coverage` | Card storage and a readable work surface frame collections and coverage; existing editor and data views stay DOM. |
| Draft table | `/draft`, `/draft/quick`, `/draft-pod`, `/draft-spectator` | Pack tray and seats show the current draft context; pick, pass, and spectator controls stay DOM. |
| Tournament wall | `/tournament`, `/tournament/:code` | Bracket display frames the event; registration and match controls stay DOM. |
| Match/archive table | `/game/:id`, `/replay` | Same spatial card map; replay uses archival treatment and playback controls, with no live action affordances. |

## Motion, failure, and performance

Game events may move or pulse existing scene objects after the committed state changes. Animation is presentation only: skip it on rapid replay seeks, context loss, route exit, or a superseding snapshot. Respect `prefers-reduced-motion` by removing camera travel and long card movement while keeping state changes immediate ([MDN reduced motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion)). No continuous ambient motion is required for game comprehension.

Feature-detect WebGL 2 before mounting the renderer. On unsupported GPU, renderer init error, or lost context, render the existing functional DOM board and DOM choices at the same route and keep the game session alive. R3F documents `Canvas fallback` and an error boundary for WebGL failure ([R3F Canvas](https://r3f.docs.pmnd.rs/api/canvas)); restoration invalidates previous GPU resources ([MDN context restored](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/webglcontextrestored_event)). Recreate scene resources from the latest committed snapshot before returning from fallback. Offer a persistent "Use 2D board" preference; a graphics failure must not turn into a game loss.

Use one canvas per active scene, lazy-load its bundle only on routes that show it, share card textures/materials, instance repeated non-interactive props, and dispose textures/geometry on unmount. Start with `frameloop="demand"`; invalidate on snapshot, hover, camera, and active animation changes. Cap/adapt DPR under load and measure draw calls, frame time, memory, input latency, and startup cost on browser, mobile, and Tauri. R3F documents demand rendering and reusing geometry/materials/instancing ([R3F performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance)); Three requires explicit disposal for resources that outlive a scene ([Three cleanup](https://threejs.org/manual/pages/cleanup.html)). Measure a normal duel and a crowded multiplayer table before setting release budgets; visual effects degrade before card text or controls.

## Staged migration

1. **Baseline and seam:** record current startup, board interaction, replay seek, and low-end/mobile behavior. Add a presentation selector at the board boundary; keep the current DOM board as the functional fallback. Do not change engine rules or adapters for a camera experiment.
2. **First end-to-end slice:** render one live 1v1 battlefield from the committed snapshot, using stable object IDs and the viewer-filtered interaction projection. A pointer hit and the equivalent keyboard DOM row open the same choice; a legal engine submission updates the snapshot and scene. Render that same state through `/replay`, with seek and playback read-only. Force WebGL 2 failure and verify the DOM board can complete the same choice. Preserve existing HUD, hand, stack, and modal coverage until their 3D equivalents meet the same contract.
3. **Complete match table:** migrate visible zones, stack, combat, counters, attachments, 3+ player seats, hidden information, animations, and mobile framing. Check every `WaitingFor` family against the DOM layer and the engine projection. Keep the fallback current as each region moves.
4. **Shared world:** give shell routes coherent station compositions and transitions while retaining their DOM controls and URLs. Add replay and desktop visual continuity; keep `/open-desktop` lightweight. Adopt a navigable hub only if the pending product decision selects it.
5. **Release gate:** profile representative crowded games, tune resource budgets, verify context recovery and 2D preference, audit keyboard/screen-reader paths, then retire any duplicated presentation code only after parity.

## Verification contract

| Scenario | Required result |
| --- | --- |
| Browser local/AI, online/P2P, Tauri desktop | Same engine snapshot and choice IDs reach the scene through existing adapters; no renderer-specific action path. |
| Live choice, modal response, canceled choice | Pointer and keyboard produce the same engine submission or cancel; unauthorized viewer sees no actionable affordance. |
| Hidden card, attachment, multiplayer elimination | Only viewer-visible faces appear; attachments and seats match the projection; seat layout does not collapse when a player leaves. |
| Replay load, rapid seek, playback, unload | Scene matches reconstructed snapshot; no stale animation or live interaction survives; controls remain DOM and read-only. |
| WebGL 2 absent, init failure, context loss/restore | DOM board and choices stay usable without restarting the game; restored scene rebuilds from the latest snapshot. |
| Mobile, keyboard, screen reader, reduced motion | Every action has a visible DOM path; focus returns correctly; essential state is readable without motion or color cues. |
| Heavy board and route transitions | Record startup, p95 frame/input time, draw calls, texture/GPU memory; no leaked renderer resources after repeated game/replay/menu transitions. |

This document specifies presentation behavior only. Rule coverage and CR validation remain in the engine.
