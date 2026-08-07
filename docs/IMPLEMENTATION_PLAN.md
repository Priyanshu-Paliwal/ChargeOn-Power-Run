# ChargeOn Power Run — Implementation Plan

## Context

**What this is.** A 3-level endless runner for the Cyntexa ChargeOn booth at Dreamforce 2026. A visitor registers, plays 2–3 minutes, collects 54 real ChargeOn features as coins while dodging real payment pain-points as obstacles, and wins a physical goodie per level plus a 25%-off offer. It runs on a booth tablet, on an attract-mode TV, and on visitors' own phones.

**Why we are doing this work.** The repo has a real Vue 3 + Three.js foundation and — importantly — the *content* layer is already correct and approved. But the 3D layer cannot ship in its current state, for three reasons that are all fatal for a live booth demo:

1. **`public/` is 416 MB.** `Desert_field.glb` alone is 299 MB (10,664 nodes of raw scan geometry). `MetalRailing.glb` is 35 MB for a *single* mesh and gets cloned 450 times at runtime. Trees are 18–30 MB each. These are scan/CAD-grade assets being used as game assets. On booth wifi, on a phone, this never loads.
2. **The game is currently unwinnable.** Level 1 requires 22 unique features, the spawner puts roughly 4 coins in the entire visible world, and duplicate coins don't count toward progress. Expected coins a player must physically collect to finish Level 1 ≈ 81. See "Findings" below.
3. **Nothing about the 3D view is responsive.** The camera has a fixed 60° vertical field of view, so on a portrait phone the three lanes are cropped off the sides while on a desktop the character is a distant speck. CSS media queries cannot fix this — it is a 3D projection problem and needs a camera solver.

**Intended outcome.** A demo-ready runner with Subway-Surfers-grade feel and polish: 4 selectable characters, a mixed obstacle moveset, coin-trail patterns, themed power-ups, juicy feedback, and a view that frames correctly on every screen from a 360×640 phone to a 4K booth TV — loading in under ~20 MB and holding 60 fps on mid-range mobile.

---

## Decisions locked in this session

| Topic | Decision |
|---|---|
| Characters | **4 playable, all selectable**: 1 male suit, 1 female suit, 2 anime. Shared skeleton + shared animation clips. |
| Environment art | **Keep every visual element** (railings, trees, small house, buildings, terrain). Optimize file size and draw cost only — do not remove anything. |
| Obstacles | **Mixed interaction system**: high drones (lane switch), low drones (slide), low barricades (jump), wide barricades (lane switch). |
| Extras | Coin-trail patterns, ≥1 power-up, progressive difficulty. |
| Scope | Rewrite `src/game/*` only. Keep `App.vue` state machine + `GameContent.js`. Add new UI components. |
| Never delete | **`Landing.vue` (the Lobby) and `RegistrationForm.vue` (Registration)** — both kept and polished. |
| Polish bar | Subway Surfers quality: animated counters, pause menu, character select, juice, SFX hooks, smooth camera and transitions. |

---

## A short glossary (no game-engine background assumed)

You'll see these terms throughout. They're the only jargon in the plan.

- **Draw call** — one instruction from the CPU to the GPU: "draw this thing." Mobile GPUs choke somewhere around 100–150 per frame. We currently issue *hundreds* because every tree is drawn separately.
- **InstancedMesh** — one draw call that renders the same mesh many times at different positions. 450 railings become 1 draw call instead of 450. This is the single biggest performance lever we have.
- **Object pool** — allocate all your coins/obstacles once at startup, then hide and reuse them instead of creating and destroying them mid-game. Creating objects during play causes the browser's garbage collector to run, which shows up as a visible stutter.
- **Delta time (`dt`)** — seconds elapsed since the last frame. Every movement must be multiplied by it, otherwise the game literally runs faster on a fast device.
- **Fixed timestep** — running the physics/collision at a constant rate (e.g. 60 Hz) regardless of render rate, so collisions behave identically on a 30 fps phone and a 144 Hz monitor. Without it, a slow device can tunnel the player straight through an obstacle.
- **Frustum** — the pyramid-shaped volume the camera can see. "Framing" = making sure the right things fall inside it.
- **DPR (device pixel ratio)** — how many physical pixels per CSS pixel. A phone at DPR 3 renders 9× the pixels of DPR 1 for the same layout. Uncapped, this alone kills mobile framerate.
- **Draco / KTX2** — compression formats for 3D geometry and textures respectively. Roughly 10× and 6× smaller, decoded on the GPU.

---

## Findings from the existing code

These are the specific things driving the plan. Every one is verified in the current source.

### Blocking

- **`public/` = 416 MB.** `Desert_field.glb` 299 MB / 10,664 nodes; `MetalRailing.glb` 35 MB / 1 mesh; `poplar1.glb` 29 MB; `maple1.glb` and `whitePoplar1.glb` 18 MB each; `old_small_house.glb` 4.8 MB; building PNG textures 6.8 MB.
- **`public/textures/grass_normal.jpg` is 14 bytes containing the literal text `404: Not Found`.** `scripts/downloadAssets.js` saved an HTTP error body to disk. The ground normal map has been silently broken this whole time.
- **Level 1 is mathematically unwinnable.** `WorldGenerator.setLevel()` builds a spawn bag of 3 copies of each of the 22 features. `App.vue:63` only counts a coin if that feature name hasn't been collected before. So finishing Level 1 means drawing all 22 unique names out of a shuffled bag with replacement — the coupon-collector problem, expected ≈ 22 × H(22) ≈ **81 coins collected**. Meanwhile `populateChunk` spawns at most **one** coin *or* blocker per *every other* chunk, at a 50% coin/blocker split, across a 15-chunk world. Roughly 4 coins exist in the entire visible world.
- **Success popups are never displayed.** `GameHUD.vue:51` filters with `p.type !== 'success'`, and coin pickups are pushed as `'success'`. Collecting a feature currently shows nothing on screen.

### Performance

- **Full scenery rebuild every ~0.67 s.** On each chunk recycle, `populateChunk` runs `SkeletonUtils.clone()` on ~30 railings, ~50 trees, up to 2 buildings and 2 streetlights — deep-cloning multi-megabyte meshes during gameplay. This is the frame-hitch source.
- **No instancing.** Every tree, railing and building is an individual object and draw call.
- **DPR decided once from `window.innerWidth < 768`** (`Engine.js:38`). A landscape phone at 900 px wide is treated as a desktop and renders at DPR 1.5.
- **No adaptive quality.** Bloom, 2048² shadow maps and a spotlight run at full cost on every device.
- **`dispose()` leaks.** `Engine.js:472` calls `removeEventListener("resize", this.onWindowResize.bind(this))` — `.bind()` returns a *new* function, so the listener is never removed. `Player.setupControls()` never removes its `window` key/touch listeners at all.

### Responsiveness

- **Fixed 60° vertical FOV** (`Engine.js:21`). Horizontal FOV = `2·atan(tan(30°)·aspect)`. On a 9:19.5 portrait phone that's ≈30° — the lanes clip at the screen edges. On 16:9 desktop it's ≈92° — the character is tiny. Same game, wildly different playability.
- **Sizing from `window.innerWidth/innerHeight`** — wrong on mobile while the URL bar animates; no `visualViewport`, no `ResizeObserver`, no `orientationchange`.
- `#app { height: 100vh }` in `style.css:40` — the classic mobile viewport bug (100vh exceeds the visible area under the URL bar).
- No `env(safe-area-inset-*)` handling and no `viewport-fit=cover`, so the HUD will sit under the iPhone notch and home indicator.
- UI breakpoints are `max-width` only. A 1024 px tablet in portrait and a 1024 px laptop get the same layout despite being completely different shapes. No handling at all for **short landscape** (phone landscape, ~400 px tall) where the current HUD and side panel cannot fit.

### Gameplay

- **The camera sways sideways during play** — `Engine.js:453` adds `Math.sin(time * 0.5) * 1.5` to camera X while running. Lanes drift under the player; precise dodging is impossible.
- **Sliding does not change the hitbox.** `checkCollisions` uses a constant 1.2 × 2.0 × 1.2 box (`Engine.js:382`). `Player.slide()` only rotates the model. Sliding under anything cannot work.
- **Jump physics contradict the drone design.** Apex = `jumpForce²/(2·|gravity|)` = `15²/80` = **2.81 units**, but "flying" blockers spawn at y = 2.5 — so they're jumpable, contradicting the intended lane-switch-only drone.
- **No solvability guarantee.** Obstacle lanes are chosen at random with no check that a passable lane exists.
- Collision is a brute-force scan over every child of every chunk, every frame.
- Character variants recolor by overwriting *every* material with one flat colour (`Player.js:256`), destroying the model's textures.

### Content fidelity

- `GameContent.js` is **excellent** — all 54 features, exact names, correct Admin/Business tags, correct `isExclusive` flags. Reuse as-is.
- But the **per-feature exclusive celebration lines are missing.** The script gives each exclusive a unique line ("Map payments to any Salesforce object. Not just one."); the code shows a generic `★ Exclusive to ChargeOn!` for all of them.
- The approved script **contradicts itself on drones** (`How to Play` says slide under them; the Overview and Level 2 intro say lane-switch only). Per your decision we implement the mixed system and correct both lines.
- Unimplemented script items: TV attract-mode idle loop, idle-timeout prompt ("Still there? Tap to keep going."), loading label.
- `MainMenu.vue`, `DemoBooking.vue`, `PrizeWheel.vue` are not imported anywhere. **Nothing will be deleted** — see Milestone 9.

---

## Architecture

### What we keep vs. rewrite

**Keep and build on**
- `src/App.vue` — the state machine flow is correct and matches the script.
- `src/data/GameContent.js` — all 54 features verified against the script. Only additive change: per-feature `exclusiveLine`.
- `src/ui/Landing.vue` (**Lobby**) and `src/ui/RegistrationForm.vue` (**Registration**) — kept, made responsive, and given a full animation pass.
- All other `src/ui/*.vue` screens — copy is script-accurate; they get responsiveness + polish, not rewrites.
- `gsap` — already a dependency and currently **unused**. It becomes the animation backbone for counters and UI motion.
- The three building GLBs (~130 KB each, properly textured) and `StreetLightPoles.glb` (315 KB) — already reasonable.

**Rewrite** — `src/game/` (currently 3 files) becomes:

```
src/game/
├── config/
│   └── GameConfig.js        # every tunable number in one file
├── core/
│   ├── Engine.js            # orchestrator + fixed-timestep loop
│   ├── ViewportManager.js   # the single source of truth for screen size
│   ├── CameraRig.js         # responsive framing solver + follow + FX
│   ├── QualityManager.js    # quality tiers + live FPS auto-downgrade
│   ├── AssetRegistry.js     # manifest loader (Draco/KTX2) + progress
│   ├── ObjectPool.js        # generic reusable pool
│   └── Signals.js           # tiny event bus, engine <-> Vue
├── world/
│   ├── WorldStreamer.js     # chunk lifecycle (replaces WorldGenerator)
│   ├── SceneryInstancer.js  # InstancedMesh manager for all scenery
│   ├── TrackBuilder.js      # road/lane geometry
│   ├── PatternLibrary.js    # authored track segments (data)
│   └── SpawnDirector.js     # difficulty-driven selection + solvability
├── entities/
│   ├── Player.js            # movement + state machine + hitbox
│   ├── CharacterLoader.js   # 4-character / shared-clip pipeline
│   └── Pickups.js           # coin, obstacle, power-up definitions
└── systems/
    ├── InputManager.js      # keyboard/touch/pointer + input buffering
    ├── CollisionSystem.js   # swept AABB, active entities only
    ├── EffectsSystem.js     # particles, screen shake, hitstop
    ├── ScoreSystem.js
    └── AudioManager.js
```

The engine never imports Vue and Vue never reaches into the engine internals — they talk over `Signals.js`. This keeps the 3D layer testable and stops UI re-renders from touching the render loop.

---

## Responsive design strategy

This is the top priority, so it gets the most detail. There are **three independent layers**, and all three have to be right. Most projects only do the third.

### Layer 1 — The viewport contract (`ViewportManager.js`)

One module owns screen measurement. Nothing else in the codebase is allowed to read `window.innerWidth`.

- Measures via **`ResizeObserver`** on the canvas container, not `window`. This catches every case: browser resize, device rotation, mobile URL-bar show/hide, split-screen multitasking, and the on-screen keyboard opening over the registration form.
- Cross-checks against **`window.visualViewport`** for the actual visible area on mobile (this is what `100vh` gets wrong).
- Debounced to one update per animation frame so a rotation doesn't trigger 40 expensive re-layouts.
- Publishes one immutable object that everything else subscribes to:

  ```js
  { cssW, cssH, dpr, aspect, orientation, sizeClass, safeArea }
  ```

- Writes `--app-w`, `--app-h`, `--safe-top/right/bottom/left` as CSS custom properties on `:root`, so the Vue layer and the 3D layer are provably reading the same numbers.

**Size classes** are derived from *aspect and area together*, never width alone — because a 1024 px tablet in portrait and a 1024 px laptop are entirely different problems:

| Class | Condition | Layout consequence |
|---|---|---|
| `phone-portrait` | aspect < 0.75, min-dim < 500 | Single column, bottom-anchored controls |
| `phone-landscape` | aspect > 1.6, height < 500 | **Short-landscape mode** — HUD collapses to icons, side list becomes a badge |
| `tablet-portrait` | 0.6 ≤ aspect < 1.0, min-dim ≥ 500 | Roomy single column, larger touch targets |
| `tablet-landscape` | 1.0 ≤ aspect ≤ 1.6, min-dim ≥ 500 | Two-column; the booth tablet's primary mode |
| `desktop` | aspect > 1.3, width ≥ 1200 | Full layout, keyboard hints shown |
| `tv` | width ≥ 1920 and coarse/no pointer | Attract mode, oversized type, no interactive affordances |

### Layer 2 — The responsive camera (`CameraRig.js`) — the part CSS cannot do

**The problem, concretely.** A `PerspectiveCamera` is defined by its *vertical* FOV. The horizontal FOV falls out of the aspect ratio:

```
hFOV = 2 · atan( tan(vFOV / 2) · aspect )
```

At a fixed vFOV of 60°, a 9:19.5 portrait phone (aspect 0.46) gets hFOV ≈ 30° and the outer lanes fall outside the screen. A 16:9 desktop (aspect 1.78) gets hFOV ≈ 92° and the character shrinks into the distance. **The game is a different game on every device.** This is the actual bug behind "not responsive" in a 3D title.

**The solution — fit a play box, not a FOV.** We declare the world-space volume that *must* always be visible, then solve for the camera every time the viewport changes. This is the 3D equivalent of `object-fit: contain`.

```js
// GameConfig.js — the guarantee, in world units
FRAMING = {
  laneSpanX:   8.0,   // 3 lanes (-3..3) + 1 unit margin each side
  headroomY:   6.0,   // ground to above jump apex
  lookAheadZ: 45.0,   // MUST be constant: this is the fairness guarantee
}
```

Each resize we solve for the vertical FOV that contains the box on **both** axes and take the larger:

```js
const distance   = cameraToPlayBoxCenter;
const fovForY    = 2 * Math.atan((FRAMING.headroomY / 2) / distance);
const fovForX    = 2 * Math.atan((FRAMING.laneSpanX / 2) / (distance * aspect));
camera.fov       = clamp(radToDeg(Math.max(fovForY, fovForX)), 35, 78);
camera.updateProjectionMatrix();
```

Two consequences worth understanding:

- On a **narrow portrait** screen, `fovForX` wins — the camera widens (or pulls back) until all three lanes fit. Nothing is ever cropped.
- On a **short landscape** screen, `fovForY` wins — the camera compensates for the lack of vertical pixels.

**`lookAheadZ` is the fairness guarantee.** Because we always show a fixed 45 world-units of track ahead, and the world moves at a known speed, every player gets the *same reaction time in seconds* regardless of device:

```
reactionTime = lookAheadZ / worldSpeed   // ~1.5 s at level-1 speed, on every screen
```

A phone player and a desktop player face an identically difficult game. This is the single most important line in the responsive strategy — without it, difficulty silently varies by device.

**Rig presets, interpolated by aspect.** Pure contain-fit alone makes the character tiny on ultrawide. So we also blend the camera's physical placement between two authored presets:

```js
const t = clamp01(inverseLerp(0.5, 1.9, aspect));
rig = lerpRig(PORTRAIT_RIG, LANDSCAPE_RIG, t);
// PORTRAIT_RIG:  closer, higher, steeper pitch — uses the tall screen for track-ahead
// LANDSCAPE_RIG: further, lower, shallower pitch — uses the wide screen for lane clarity
```

The FOV solver then runs on top of the blended rig, so framing is guaranteed at every intermediate aspect — including mid-rotation, where the aspect passes continuously through 1.0.

**Follow behaviour.** Delete the sine-wave sway entirely. Replace with a critically-damped spring on the camera's X and Y target (framerate-independent, no overshoot, no jitter), plus deliberate, controlled motion: a small FOV kick on speed increase, a slight roll on lane change, and decaying-noise shake on impact — all owned by the rig, never by the game logic.

### Layer 3 — Resolution and render scaling

Separate from framing: how many *pixels* we render.

- **Pixel budget, not a DPR cap.** A fixed `setPixelRatio(1)` wastes a good phone; `1.5` melts a cheap one. Instead we target a total pixel count:

  ```js
  const MAX_PIXELS = 1_600_000;                     // ~1600x1000, per quality tier
  const fit = Math.sqrt(MAX_PIXELS / (cssW * cssH));
  const dpr = clamp(Math.min(devicePixelRatio, fit), 0.75, 2);
  ```

  This is resolution-independent and self-correcting: a 4K TV and a 360 px phone both land on a sane workload.
- `renderer.setSize(w, h, false)` with CSS owning the canvas box, so we never fight the layout.
- The `EffectComposer` and every post-processing pass must be resized **and** DPR-synced together — the current code sets composer size but this must stay in lockstep with the tier system.

### Layer 4 — UI/CSS responsiveness

- Replace `100vh` with `100dvh`, plus the JS-driven `--app-h` fallback for older iOS Safari.
- Add `viewport-fit=cover` to the `index.html` viewport meta and pad all fixed UI with `env(safe-area-inset-*)` so nothing hides under a notch or home indicator.
- **Fluid type scale** using `clamp()` tokens in `style.css` (`--fs-xs` … `--fs-3xl`) replacing the current fixed `rem` values. One scale, no per-component font-size media queries.
- **Container-driven layout** — components respond to `sizeClass` from `ViewportManager` (as a data attribute on the app root) rather than each maintaining its own `max-width` breakpoints. This is what stops the current problem of 14 files each inventing their own `@media (max-width: 1024px)`.
- Minimum 44 × 44 px touch targets everywhere, verified on the smallest supported screen.
- **Short-landscape is a first-class layout**, not an afterthought: on a phone in landscape the HUD collapses to a compact icon row and the "Features Collected" list becomes a tappable count badge that expands into an overlay.
- The registration form must stay usable with the on-screen keyboard open — `ViewportManager` already detects this via `visualViewport`, and the form scrolls its focused field into view.

### Control scheme adaptation

`InputManager.js` detects capability (`pointer: coarse/fine`, touch support) rather than screen size, and enables **all** applicable schemes simultaneously — a touchscreen laptop supports both:

- **Touch**: swipe gestures with velocity-and-distance thresholds (not the current fixed 30 px, which behaves differently at different DPRs), plus tap-zones as a fallback.
- **Keyboard**: arrows / WASD / Space.
- **Input buffering** (~120 ms): if the player swipes slightly before a lane change completes, the input is queued rather than dropped. This is a large part of why Subway Surfers *feels* responsive.
- Listeners bind to the **canvas container**, not `window`, so UI buttons no longer double-fire as swipes — and they are properly removed on dispose.
- On-screen hint chips appear only for the detected scheme.

---

## 3D asset plan

### The optimization pipeline

Per your decision: **keep every visual element, make it lightweight.** We add a repeatable, checked-in pipeline rather than hand-editing binaries.

- Add `@gltf-transform/cli` as a devDependency and a `npm run assets:optimize` script.
- **Originals are never deleted.** They move to `assets-src/` (excluded from the Vite build), and `public/assets/` becomes generated output. Rerunnable, reversible.
- Per asset: `dedup` → `weld` → `join` (collapse those 10,664 nodes) → `simplify` (meshoptimizer, per-asset ratio) → `prune` → `textureCompress` (WebP, KTX2 where supported) → `draco`.

| Asset | Now | Target | Approach |
|---|---|---|---|
| `Desert_field.glb` | 299 MB | ≤ 3 MB | Join 10,664 nodes, aggressive simplify. It renders as a distant base layer at scale 0.015 — it needs silhouette, not scan density. |
| `MetalRailing.glb` | 35 MB | ≤ 150 KB | Extreme simplify (it's a repeated prop seen at speed) + **InstancedMesh** for all 450 copies. |
| `poplar1.glb` | 29 MB | ≤ 250 KB | Simplify + WebP atlas; instanced per species. |
| `maple1` / `whitePoplar1` | 18 MB ea | ≤ 250 KB ea | Same. |
| `old_small_house.glb` | 4.8 MB | ≤ 400 KB | Simplify + texture compress. |
| Building GLBs ×3 | ~130 KB ea | unchanged | Already fine. |
| Building PNGs ×9 | 6.8 MB | ≤ 1.5 MB | PNG → WebP/KTX2. |
| `grass_normal.jpg` | **broken** | — | Replace the 14-byte "404: Not Found" file with a real normal map. |
| `venice_sunset_1k.hdr` | 1.4 MB | ≤ 200 KB | Only used for reflections — bake to a small env map. |

**Total target: ≤ 20 MB, from 416 MB.** Verified as a hard gate in Milestone 10.

We add a **build-time budget check** that fails the build if `public/` exceeds the budget, so this can never silently regress before the show.

### Loading strategy

`AssetRegistry.js` is manifest-driven with `DRACOLoader` + `KTX2Loader` wired up:

- **Critical** (blocks the first playable frame): track, player character, coins, obstacles.
- **Deferred** (streams in behind the Lobby/Registration screens, which the player spends ~30 s on): scenery, buildings, secondary characters.
- Real progress events feed the script's `"Loading your run..."` label.
- This also removes Issue 4 from the existing docs (the async "procedural green block" bug) by construction — the world is never built before its assets exist.

### The 4-character pipeline

The efficiency trick: **one skeleton, one animation file, four meshes.**

- All four characters are rigged to the **standard Mixamo humanoid skeleton** with identical bone names.
- Animation clips (`Idle`, `Run`, `Jump`, `Fall`, `Land`, `Slide`, `Stumble`, `Celebrate`) live in a **single shared `animations.glb`**, loaded exactly once. Because `THREE.AnimationClip` tracks address bones *by name*, the same clips drive all four characters. We pay for the animation data once, not four times.
- Character meshes carry **no** embedded animations — geometry and one texture atlas only.
- Budget per character: ≤ 25k triangles, one 1024² atlas, Draco + KTX2 → **~600 KB–1 MB each**.
- Only the selected character loads at play time; the others prefetch quietly while the selection screen is open.
- `setCharacterVariant`'s destructive material-flattening is deleted. Brand colouring is done properly, by tinting only the material slots authored for it.

**Sourcing.** 1 male + 1 female business-suit character matching the M1/F1 reference, and 2 anime characters matching the reference sets — from a rigged-humanoid marketplace asset, retextured to ChargeOn navy/gold, then run through the same optimization pipeline. `CharacterLoader.js` is written against a documented contract (Y-up, −Z forward, ~1.8 units tall, required clip names), so if your design team later supplies bespoke models they drop straight in with no code change.

---

## Gameplay systems

### Obstacle taxonomy

Your mixed-interaction decision, made unambiguous. The numbers matter: the physics has to make each obstacle's *only* valid answer physically true, or players feel cheated.

| Type | Occupies | Height band | Only escape | Read |
|---|---|---|---|---|
| `BARRICADE_LOW` | 1 lane | 0 → 1.0 | **Jump** | Striped low barrier |
| `BARRICADE_WIDE` | 2 lanes | 0 → 2.6 | **Lane switch** to the free lane | Tall wide hoarding |
| `DRONE_LOW` | 1 lane | 1.1 → 3.0 | **Slide** | Hovering drone, visible gap beneath |
| `DRONE_HIGH` | 1 lane | 0.35 → 2.6 | **Lane switch** | Drone hovering at body height, no gap |

**Tuned so each answer is the only answer.** Current jump apex is 2.81, which would clear a 2.5 "flying" blocker — the existing contradiction. Retuned:

- Jump apex **2.0** (`jumpForce` and `gravity` adjusted together), airborne hitbox bottom clears 1.0 → clears `BARRICADE_LOW`, cannot reach over `DRONE_HIGH` at 2.6.
- **Hitbox becomes state-driven** — the single most important fix in this section. `CollisionSystem` reads the capsule from the player's current state, not a constant:

  | State | Hitbox height | Result |
  |---|---|---|
  | `RUNNING` | 2.0 | hits everything |
  | `JUMPING` | 2.0, raised by jump arc | clears `BARRICADE_LOW` |
  | `SLIDING` | **0.9** | passes under `DRONE_LOW` |

- Slide becomes a proper timed state (~700 ms with a committed recovery window), not a `setTimeout` that mutates the model transform.
- Collision runs on a **fixed 60 Hz timestep with swept AABB**, so a phone dropping to 30 fps cannot tunnel the player through an obstacle — the current per-render-frame check does exactly that.

### Spawning — authored patterns, not random placement

The current "random lane, 50/50 coin-or-blocker, every other chunk" is the root cause of both the unwinnable level and the flat, unreadable pacing. It is replaced by a **pattern library**:

- A **pattern** is data describing a ~20–40 unit track segment: obstacle placements per lane, and a coin trail. Authored, tagged with a difficulty rating and the skills it demands (`jump`, `slide`, `switch`, `combo`).
- `SpawnDirector` selects patterns matching the current difficulty, enforces **variety** (no repeat within N segments), and applies two hard rules:
  1. **Solvability** — every obstacle set is verified to leave at least one traversable lane, reachable given the player's current lane and the time available at current speed. Randomly generating an impossible wall becomes structurally impossible.
  2. **Minimum reaction distance** — nothing spawns closer than `lookAheadZ`, so obstacles are always seen before they must be answered.

### Coins and progression — fixing the unwinnable level

The counting model changes to make the level completable and the pacing correct:

- Each level's feature list is dealt as a **shuffled queue without replacement**, so every coin collected is new progress. This alone takes Level 1 from ≈81 coins collected down to 22.
- Enough coins are placed that a competent player clears the level while still missing some. Level 1: 22 required over a ~60–75 s run at ~30 u/s ≈ 2000 units of track → **a coin cluster roughly every 50–60 units, ~35–40 coin opportunities**. Compare with ~4 today.
- **Coin trails** as first-class shapes, since this is where a runner's texture comes from: straight runs, **jump arcs** over a `BARRICADE_LOW` (rewarding the correct action), **S-curves** that guide a lane change, and **risk/reward lines** hugging an obstacle for players who want them.

### Power-ups (themed to real ChargeOn features)

Both map onto features already in `GameContent.js` — so the power-up *is* the marketing message, which is a nicer outcome than a generic magnet:

- **Automated Collection** (real Level 2 feature) — magnet; pulls nearby coins for ~8 s.
- **Payment Gateway Fallback Mechanism** (real Level 2 feature — *"One gateway down? We reroute automatically"*) — shield; absorbs exactly one hit. The theming is essentially perfect.

Both surface as HUD icons with radial countdown timers.

### Difficulty curve

- Per-level base speed from the script: **1.0× / 1.3× / 1.6×** (already correct in `GameContent.js`).
- Within a level, speed ramps smoothly to ~1.25× the level base over its duration, and obstacle density ramps with distance — both capped so the level stays winnable at the end.
- `lookAheadZ` scales with speed so reaction time stays constant as the game accelerates.

---

## UI/UX and polish plan

Requested explicitly, and it's what separates a demo from a booth attraction.

### New components

- **`CharacterSelect.vue`** — the 4 characters on a slow-rotating 3D turntable rendered by the live engine (not flat images), with name, swipe/arrow navigation, and prefetch-on-focus.
- **`PauseMenu.vue`** — Resume / Restart Level / How to Play / Quit; pauses the render loop and mutes audio. Also auto-triggers on `visibilitychange` so tabbing away never costs a life.
- **`GameOver.vue`** — rebuilt with a stat summary, features-collected recap, and a prominent retry.
- **HUD upgrades** to `GameHUD.vue`: GSAP-tweened counters that tick rather than snap, an animated progress bar, power-up icons with radial timers, and — critically — **the success-popup bug fixed** so collecting a feature actually shows its "Yay!" line.
- **`Toast` queue** replacing the current popup array, so rapid pickups stack and expire cleanly instead of overlapping.

### Lobby and Registration polish (kept, per your instruction)

- **`Landing.vue` (Lobby)** — staggered entrance animations on the panels, an animated logo reveal, a live 3D character turntable behind the glass, hover/press micro-interactions, and an animated leaderboard. Plus the responsive rework: it currently has no short-landscape handling at all.
- **`RegistrationForm.vue`** — focus-state field animations, inline per-field validation using the script's exact error strings (currently a single shared error line), a submit-button loading state, and a success transition into the game. Must remain fully usable with the on-screen keyboard open.

### Juice

The small feedback details that make a runner feel good:

- **Coin collect** — scale-pop, particle burst, the coin arcing to the HUD counter, a rising-pitch pickup sound, counter tick, and a combo counter for uninterrupted streaks.
- **Hit** — ~80 ms hitstop, decaying screen shake, red screen-edge vignette pulse (the script explicitly asks for edge flash, *not* a full-screen overlay), character stumble animation, and `navigator.vibrate` on supported devices.
- **Power-up** — screen-edge glow in the power-up's colour, radial HUD timer, distinct activation sting.
- **Near-miss** — small score bonus and a subtle whoosh when passing close to an obstacle. Cheap to add, disproportionately satisfying.
- **Speed-up** — FOV kick plus speed lines at level transitions.
- **Transitions** — one shared wipe transition between states, with the 3D scene staying live underneath.

### Audio (`AudioManager.js`)

- Sprite-based SFX (a single file with time offsets — far fewer requests), music with ducking under stingers, and a master mute honouring the existing Lobby toggle.
- **Replace the remote SoundHelix URL** with local files. It is an external dependency that will fail on booth wifi, and it is a licensing question for a commercial event.
- Built with silent placeholder stubs so every hook is wired and testable before final audio arrives. Audio unlocks on the first user gesture (Registration submit) to satisfy browser autoplay policies.

### Onboarding and booth behaviour

- **Interactive tutorial** — a scripted, slowed-down first ~15 seconds that presents one obstacle per mechanic and *waits for the correct input*, instead of a wall of text. Booth visitors give a game about five seconds.
- **Attract mode** — the TV idle loop from the script, with its two caption lines. Currently unimplemented.
- **Idle timeout** — the script's "Still there? Tap to keep going." prompt, and an auto-reset to Lobby so the booth tablet is always ready for the next visitor.

---

## Build order

Ten milestones, each independently reviewable and demoable. Approve and execute one at a time.

| # | Milestone | Delivers | Why here |
|---|---|---|---|
| **1** | **Asset optimization pipeline** | `assets:optimize` script; originals moved to `assets-src/`; 416 MB → ≤ 20 MB; broken `grass_normal.jpg` replaced; size budget check in the build | Biggest risk, blocks everything, and independently verifiable |
| **2** | **Responsive core** | `ViewportManager`, `CameraRig` with the framing solver, `QualityManager`, pixel budget, `100dvh` + safe-area + fluid type tokens | The top requirement; visible improvement on day one |
| **3** | **World rewrite** | `WorldStreamer` + `SceneryInstancer` + `TrackBuilder`; instanced scenery, zero mid-game allocation | Kills the 0.67 s hitch and the draw-call count |
| **4** | **Player and input** | `Player` state machine, state-driven hitbox, retuned jump/slide, `InputManager` with buffering, fixed-timestep `CollisionSystem` | Makes the mixed obstacle system physically possible |
| **5** | **Obstacles, patterns, difficulty** | Four obstacle types, `PatternLibrary`, `SpawnDirector` with solvability + reaction guarantees, difficulty ramp | The core gameplay |
| **6** | **Coins, power-ups, scoring** | No-replacement feature queue (fixes the unwinnable level), coin-trail shapes, the two themed power-ups, `ScoreSystem` | Makes the game completable and rewarding |
| **7** | **4 characters** | `CharacterLoader`, shared skeleton + single shared clip file, 4 optimized models, `CharacterSelect.vue` | Depends on the M1 pipeline |
| **8** | **UI build-out and polish** | HUD upgrades + success-popup fix, `PauseMenu`, rebuilt `GameOver`, animated counters, power-up icons, **Lobby + Registration animation and responsiveness pass** | Needs M2's responsive tokens |
| **9** | **Juice, audio, onboarding** | Particles, shake, hitstop, camera FX, transitions, `AudioManager` + local audio, tutorial, attract mode, idle timeout. **Content-script corrections** (drone lines, per-feature `exclusiveLine`). Unreferenced files (`MainMenu`, `DemoBooking`, `PrizeWheel`) **moved to `src/ui/_unused/`, not deleted** — `PrizeWheel` proposed for reuse as the Level Complete goodie reveal | The Subway-Surfers feel layer |
| **10** | **Device QA, perf validation, docs** | Full device matrix pass, perf gates enforced, `initial_implementation_documentation.md` corrected and updated | Ship gate |

---

## Verification

### Performance gates (hard pass/fail before Dreamforce)

| Metric | Target |
|---|---|
| Total download | ≤ 20 MB |
| Time to interactive, throttled "Fast 3G" | ≤ 8 s |
| Sustained FPS, mid-range Android (e.g. Pixel 6a / Galaxy A54) | ≥ 55 fps |
| Sustained FPS, iPad (booth device) | 60 fps locked |
| Draw calls per frame | ≤ 120 |
| Frame-time spikes during a 3-minute run | none > 32 ms |
| JS heap growth over a full 3-level run | < 10 MB (proves pooling works) |

Measured with Chrome DevTools performance traces, `spector.js` for draw calls, and an in-game debug overlay (toggled by a query param) showing FPS, draw calls, triangles and active pool counts.

### Responsiveness matrix

Every combination must show: no cropped UI, all three lanes fully visible, no horizontal scroll, no element under a notch, and touch targets ≥ 44 px.

- **Phones portrait**: 360×640, 390×844 (iPhone 14), 412×915, 430×932
- **Phones landscape**: 640×360, 844×390, 932×430 ← *the hardest case; most likely to break*
- **Tablets**: iPad Mini / Air / Pro, both orientations
- **Desktop**: 1280×720, 1920×1080, 2560×1440, 3440×1440 ultrawide
- **Edge cases**: 320 px wide, window resized to 500×300, **live rotation mid-run**, on-screen keyboard open on Registration, browser zoom 50–200%

Verified against real devices where available and Chrome device emulation otherwise; the ultrawide and rotation-mid-run cases are the ones most likely to expose framing bugs, so they get explicit manual passes.

### Gameplay verification

- Each of the four obstacle types is provably answerable **only** by its intended action — automated test asserting the hitbox/height relationships hold at every state.
- 20 scripted runs confirm no unsolvable pattern is ever generated.
- Level 1 completes in 60–90 s at competent play; all three levels in the 2–3 minutes marketing promised.
- Full flow test: Lobby → Registration → How to Play → Story → L1 → L2 → L3 → Boss → Offer → Victory → Redemption, plus the Game Over branch, on both a phone and the booth tablet.
- Every on-screen string diffed against the content script — it is the source of truth.

### How to run it

```bash
npm install
npm run assets:optimize   # new in Milestone 1; regenerates public/assets from assets-src
npm run dev               # http://localhost:5173
npm run build && npm run preview
```

For device testing, `vite --host` exposes it on the LAN so real phones can hit it.

---

## Assumptions and open items

Flagging rather than blocking — none of these stop Milestone 1 starting.

1. **Lead capture is a `console.log`.** `App.vue:124` logs `'CRM WRITE'`. Marketing's overview says leads are "written to our system the instant someone submits." I'll build a pluggable `LeadService` adapter with a local-storage fallback and a documented interface; **I need the actual endpoint/credentials before the show**, and it should queue-and-retry offline given booth wifi.
2. **Brand colours are unconfirmed.** The overview lists "exact brand blue/gold from the Figma file" as still open. Current values (`#042C53`, `#F4C775`, `#00B0FF`) are centralized in `style.css` so a swap is one commit.
3. **Payment gateway count** on the Victory screen — the script says re-verify "19+ payment gateways" against the live site close to launch. Currently not displayed; leaving it out until confirmed.
4. **Character source assets** need purchasing/licensing for commercial event use.
5. **Audio assets** need sourcing with a commercial licence.
6. **The docs file is out of date** — `initial_implementation_documentation.md` claims a React migration, but the codebase is Vue 3 + Pinia (and Pinia is installed but unused). Corrected in Milestone 10.
7. **Goodie pools** — the overview flags exact level-to-pool assignment as needing confirmation. Current values in `GameContent.js` match the suggested first pass.
