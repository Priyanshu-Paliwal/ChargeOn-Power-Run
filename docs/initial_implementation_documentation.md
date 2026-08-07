# ChargeOn Power Run - Initial Implementation Documentation

**Date:** August 2026  
**Status:** Alpha / Initial Release  

---

## 1. Project Overview & Origins
**ChargeOn Power Run** is a 3D endless-runner style web game developed for **Dreamforce '26**. The goal of the project was to create a highly engaging, interactive, and visually stunning gamified experience to showcase ChargeOn's Salesforce-native payment solutions.

We started with a basic Vite + Vue 3 template (later migrated to React) and integrated **Three.js** to handle the 3D rendering. Over the course of development, we transformed it from a simple prototype into a fully responsive, polished AAA-style browser game featuring post-processing, procedural world generation, and a complete UI state machine.

---

## 2. Agreement Protocol
Moving forward, this documentation will be updated incrementally immediately following the approval of any new feature or fix. I will not overwrite the entire document, but will carefully append or update the specific parts that have changed.
---

## 3. Game Design Document (GDD)

### Core Gameplay Loop
The player controls a futuristic character running forward on a 3-lane track. The primary objective is to outrun payment problems by dodging obstacles and collecting "Features" (power-ups/score points) scattered across the track.

### Win / Lose Conditions
- **Lose Condition:** Hitting blockers/obstacles reduces the player's life count. If lives reach 0, the game is over. 
- **Win Condition (Per Level):** Collecting the required number of "Features" mapped to the current level completes the stage. The player unlocks an exclusive offer upon finishing all levels.

### Controls
- **Movement:** Left / Right Arrow Keys (or `A` / `D`) to smoothly switch lanes.
- **Jump:** Spacebar or Up Arrow Key to jump over obstacles.

### Levels / Stages Structure
- **Level 1 to N:** As levels progress, the running speed incrementally increases (via `speedMultiplier`).
- **Dynamic Spawning:** The track procedurally spawns blockers and features based on the current level requirements. The game generates a 3D chunk pool that cycles infinitely as the player runs.

---

## 4. Asset Inventory & Art Style

### Current 3D Models (GLB) & Textures
- **Buildings (`public/assets/models/buildings/`)**
  - `L_build_1.glb` (With L1 Texture Maps)
  - `L_build_2.glb` (With L2 Texture Maps)
  - `L_build_3.glb` (With L3 Texture Maps)
  - `old_small_house.glb`
- **Environment (`public/assets/models/environment/`)**
  - `Desert field.glb` (Background base layer)
  - `MetalRailing.glb` (Track borders)
  - `StreetLightPoles.glb` (Lighting along the track)
- **Trees (`public/assets/models/trees/`)**
  - `maple1.glb`
  - `poplar1.glb`
  - `whitePoplar1.glb`

### Missing / Future Assets Needed
- Custom 3D meshes for power-ups (currently using procedural spheres/icons).
- Unique 3D obstacle models (currently using procedural barricades).
- Custom UI overlays/fonts specifically branded to Cyntexa.

### Art Style Reference
- **Low-Poly & Vibrant:** Clean, baked textures with dynamic lighting.
- **Warm Cinematic Lighting:** Uses a tight shadow frustum and an intense warm directional light to simulate a cinematic sunset glow. 

---

## 5. Technology Stack & Directory Structure
* **Core Framework:** React (via Vite) (Migrated from Vue 3)
* **3D Rendering Engine:** Three.js (WebGL)
* **Build Tool:** Vite
* **Styling:** CSS Modules / Vanilla CSS (Responsive, Mobile-First)
* **Languages:** JavaScript (ES6+), HTML5, CSS3

### Project Architecture & Directory Structure
The project is structured to strictly separate the **3D Game Engine** from the **2D User Interface**, while also handling static assets.

```text
ChargeOn Power Run/
├── docs/
│   └── initial_implementation_documentation.md # This living document
|   └── ChargeOn_Power_Run_Content_Script (1).docx
|   └── ChargeOn_Power_Run_Simple_Overview (1).docx
|   └── Character-Images.png
|
├── index.html              # Main HTML entry point for the Vite app
├── package.json            # Node dependencies (Three.js, React, Vite)
├── vite.config.js          # Vite build configuration
├── public/                 # STATIC ASSETS (Served directly by Vite)
│   ├── assets/             # Refactored 3D models and textures
│   │   ├── models/
│   │   │   ├── buildings/  # L_build_1, L_build_2, L_build_3, old_small_house
│   │   │   ├── environment/# Desert field, MetalRailing, StreetLightPoles
│   │   │   └── trees/      # maple1, poplar1, whitePoplar1
│   │   └── textures/       # Materials and maps
│   └── models/             
│       └── Soldier.glb     # 3D Character model
├── refactor_assets.js      # Utility script for asset management
└── src/
    ├── App.jsx             # The root React component and State Machine controller
    ├── main.jsx            # React application entry point
    ├── index.css           # Global CSS resets and fonts
    ├── data/
    │   └── GameContent.js  # Centralized content (Levels, Features, Pain Points, Dialogues)
    ├── game/               # THREE.JS 3D ENGINE
    │   ├── Engine.js       # Main render loop, collision detection, and asset loader
    │   ├── Lighting.js     # Environment lighting and shadows
    │   ├── Player.js       # 3D character mesh, animations, and lerp physics
    │   ├── PostProcessing.js # Visual effects (Bloom, Depth of Field, Outlines)
    │   └── WorldGenerator.js # Procedural track generation and chunk pooling
    └── ui/                 # REACT 2D OVERLAYS
        ├── Landing.jsx     # Main menu, Leaderboard, Character Selection
        ├── GameHUD.jsx     # Heads-up display (Lives, Progress bar, Collected Features)
        ├── GameOver.jsx    # Out of lives screen
        └── ...             # Other narrative and marketing funnel components
```

---

## 6. The Game Loop & State Machine

The entire flow of the application is managed in `App.jsx` using a reactive `gameState` variable. The UI React components are dynamically mounted/unmounted based on this state, overlaying the persistent 3D `<canvas>` in the background.

**State Flow:**
1. `LANDING`: The user arrives, selects a character color, and toggles music.
2. `REGISTRATION`: Lead capture form (Name, Company, Email).
3. `HOW_TO_PLAY`: Quick tutorial on mechanics.
4. `STORY_BEAT`: Narrative introduction.
5. `LEVEL_INTRO`: Displays target feature count for the level.
6. `PLAYING`: The 3D Engine is unpaused. The user controls the character. `GameHUD` is active.
7. `LEVEL_COMPLETE`: Triggered when the required number of features is collected.
8. `BOSS_BEAT` -> `OFFER_REVEAL` -> `VICTORY` -> `REDEMPTION`: The end-game marketing funnel.
* *Alternative Flow:* If the player hits 3 blockers, the state switches to `GAME_OVER`.

---

## 7. Core Game Mechanics

### Input & Controls
* **Keyboard:** Left/Right Arrow keys or A/D to switch lanes.
* **Movement:** The character runs automatically on a 3-lane track.
* **Mobile/Tablet:** The UI is fully responsive, setting the stage for future mobile swipe controls.

### Procedural Generation (`WorldGenerator.js`)
* The track is built in "chunks". As the player moves forward, old chunks behind the camera are destroyed and new chunks are spawned ahead.
* **Scenery:** Trees and skyscrapers are randomly scaled and placed on the periphery.
* **Spawning Algorithm:** Coins (Features) and Blockers (Pain Points) are spawned dynamically. We heavily tuned the ratio so that blockers spawn at a roughly ~50% clip to keep the game appropriately challenging.

### Entities & Collisions
* **Features (Coins):** 3D spinning cylinders. Collecting them adds to the user's progress. "ChargeOn Exclusive" features grant special popups.
* **Blockers (Obstacles):** 3D red boxes (some on the ground, some flying in later levels). Hitting these triggers an error popup, shakes the camera, and removes 1 of the player's 3 lives.

---

## 8. UI & Design Philosophy
* **Glassmorphism & Blur:** UI elements heavily utilize `backdrop-filter: blur()` and semi-transparent backgrounds to ensure the 3D game world is always visible underneath.
* **Typography:** Bold, clean sans-serif fonts. Font sizes were optimized (e.g., `1.6rem` headers) to prevent screen clutter.
* **Responsiveness:** Popups are capped at specific max-widths with responsive paddings (strictly max `20px` padding on mobile/tablet).
* **Button UX:** Primary buttons (`.btn-primary`) feature uppercase text, letter spacing, drop shadows, and physical push-down animations (`transform: translateY(-2px)`) on click/hover for tactile feedback.

---

## 9. Audio & Music
* Implemented a global `<audio>` tag playing an upbeat, royalty-free electronic synth track via an external reliable URL (SoundHelix).
* Controlled via a global React context/state (`musicState`).
* A sleek toggle button (🔊/🔇) lives in the `Landing` top-bar, allowing the user to initiate playback prior to starting the game.

---

## 10. Issues Log & Resolutions

Throughout development, we encountered and resolved several critical roadblocks to ensure an optimal user experience:

### Issue 1: Performance Lags with High-Fidelity Assets
* **Problem:** We attempted to introduce photorealistic PBR materials. However, this caused massive frame drops, lag, and camera shaking, rendering the game unplayable on lower-end devices and mobile screens.
* **Resolution:** We utilized Three.js's procedural `Sky` shader instead of a heavy HDR texture for the background. Crucially, we strictly capped the `renderer.setPixelRatio` to `1` on mobile screens. We also enabled `matrixAutoUpdate = false` on all static environment pieces (thousands of trees and buildings) and aggressively culled the `dirLight.shadow.camera` frustum to eliminate off-screen shadow mapping.

### Issue 2: Mobile UI and Popup Bloat
* **Problem:** The various UI popups were taking up too much screen real estate on mobile screens.
* **Resolution:** We enforced a strict responsive CSS diet across all components, standardizing maximum widths, scaling fonts down, and compressing paddings to a maximum of `20px`.

### Issue 3: Missing Building Textures
* **Problem:** The large white buildings disappeared completely from the world after folder restructuring.
* **Why:** The Normal Maps were renamed from `L1_Normal_OpenGL.png` to `L1_Normal.png`. The `Engine.js` hardcoded string was still looking for the old name, triggering a 404 crash in the loader.
* **The Fix:** Always ensure the string paths in the `loadBuilding` function exactly match the raw filenames in the `public/assets/` folder.

### Issue 4: The "Procedural Green Block" Async Bug
* **Problem:** The game reverted to showing blocky procedural trees and buildings instead of the beautiful GLB models upon initial load.
* **Why:** The `loadAssets()` function in Three.js is *asynchronous*. The `WorldGenerator` was building the first 15 chunks of the track *synchronously* during boot. Because the models weren't finished loading yet, it panicked and fell back to procedural blocks. 
* **The Fix:** Added a forced repopulation loop (`this.world.trackPool.forEach`) that runs the absolute millisecond the background asset loader finishes, instantly swapping the blocks for the final 3D models.

### Issue 5: Wild Model Scaling & Road Overlaps
* **Problem:** Giant trees filled the screen, and the small house spawned directly in the middle of the road.
* **Why:** 3D models from the internet have completely different origin points and internal scales. The engine was placing them blindly.
* **The Fix:** We implemented a dynamic `Box3` mathematical calculation inside `WorldGenerator.js`. It now measures the *exact physical size* of any model you give it, normalizes its scale (e.g., forcing all trees to be exactly 15-25 units tall), finds its true geometric center, and pushes it safely outside the road boundaries (`x = ±25`).

### Issue 6: Backwards Streetlights
* **Problem:** Streetlights were facing parallel to the road instead of leaning over it, and were sticking out into the track.
* **Why:** The GLB model was built facing along the X-axis, not the Z-axis. Rotating it 90 degrees (`Math.PI / 2`) pointed it in the wrong direction.
* **The Fix:** Set the rotations to exactly `0` and `Math.PI` depending on the side of the road, and pushed their starting positions to `x = ±5.5` so they sit behind the metal railings perfectly.

---

## 11. Summary of Development Progress
* **Phase 1:** Engine scaffold, basic Three.js setup, camera follow, chunk generation.
* **Phase 2:** UI overlay integration, State Machine setup, and GameContent data mapping. Integration of `public/models/Soldier.glb`.
* **Phase 3:** Visual upgrades: custom character models, particle effects, lighting, and procedural cityscapes.
* **Phase 4:** Performance Optimization: Scrapping heavy PBR textures in favor of low-poly aesthetics. Optimizing pixel ratios for mobile.
* **Phase 5:** UI Polish: Shrinking the Game HUD, optimizing popup padding, refining font weights, fixing button UX.
* **Phase 6:** Audio integration, complete documentation generation, and establishment of the incremental update protocol.
* **Phase 7:** Aesthetic Overhaul & Optimization. Integrated procedural `Sky` atmosphere and `UnrealBloomPass`. 
* **Phase 8:** Photorealistic Generation. Rewrote the procedural generation logic for the environment. Replaced basic Cone trees with organic branching.
* **Phase 9:** Custom 3D Asset Pipeline. Replaced procedural track borders and skyscrapers with custom external `.glb` models loaded asynchronously via `GLTFLoader`. Implemented an asset caching layer in `Engine.js` that pre-loads models before initializing `WorldGenerator`, and utilized `SkeletonUtils.clone()` for efficient memory re-use.
* **Phase 10:** Mathematical World Bounds & Restructuring. Cleaned up the `public/` directory into a strict `/assets/models` and `/assets/textures` architecture. Implemented Box3 bound calculation in `WorldGenerator.js` to dynamically scale, rotate, and center any external GLB, ensuring they always sit perfectly outside the road without manual tweaking. Eliminated procedural fallbacks with an async repopulation technique.
