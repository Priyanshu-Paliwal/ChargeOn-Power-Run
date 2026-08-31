# ChargeOn Power Run - Implementation Documentation

**Date:** August 2026  
**Status:** Beta / Pre-Release  

---

## 1. Project Overview & Origins
**ChargeOn Power Run** is a 3D endless-runner style web game developed for **Dreamforce '26**. The goal of the project was to create a highly engaging, interactive, and visually stunning gamified experience to showcase ChargeOn's Salesforce-native payment solutions.

We started with a basic Vite + Vue 3 template and integrated **Three.js** to handle the 3D rendering. Over the course of development, we transformed it from a simple prototype into a fully responsive, polished AAA-style browser game featuring post-processing, high-performance object pooling, and a complete UI state machine.

---

## 2. Agreement Protocol
Moving forward, this documentation will be updated incrementally immediately following the approval of any new feature or fix. We do not overwrite the entire history, but carefully append or update the specific parts that have changed to maintain an accurate living record.

---

## 3. Game Design Document (GDD)

### Core Gameplay Loop
The player controls a futuristic character running forward on a 3-lane track. The primary objective is to outrun payment problems by dodging obstacles and collecting "Features" (power-ups/score points) scattered across the track.

### Win / Lose Conditions
- **Lose Condition:** Hitting blockers/obstacles reduces the player's life count. If lives reach 0, the game is over. 
- **Win Condition (Per Level):** Collecting the required number of "Features" mapped to the current level completes the stage. Features are dealt as a shuffled queue without replacement. The player unlocks an exclusive offer upon finishing all levels.

### Controls
- **Movement:** Left / Right Arrow Keys (or `A` / `D`) or Mobile Swipes (Left/Right) to smoothly switch lanes.
- **Jump:** Spacebar, Up Arrow Key, or Swipe Up to jump over obstacles (BARRICADE_LOW).
- **Slide:** Down Arrow Key, `S`, or Swipe Down to slide under flying obstacles (DRONE_LOW).

### Levels / Stages Structure
- **Level 1 to 3:** As levels progress, the running speed incrementally increases (via `speedMultiplier`) and obstacle density ramps up.
- **Dynamic Spawning:** The track procedurally spawns blockers and features based on the current level requirements. The game generates a 3D chunk pool (`WorldStreamer`) that cycles infinitely as the player runs.

---

## 4. Asset Inventory & Art Style

### Current 3D Models (GLB)
- **Playable Characters (`public/assets/characters/`)**
  - `male_suit.glb`
  - `female_suit.glb`
  - `anime_tech.glb`
  - `anime_wizard.glb`
- **NPC Characters (`public/assets/characters/`)**
  - `thalapathy_vijay_3d_model.glb`
  - `businessman_character_ankit_rigged.glb`
  - `professional_male_causual_dress.glb`
  - `professional_female_black_dress.glb`
  - `gentleman_in_shirt.glb`
  - `commanding_coach_model.glb`
  - `big_black_man.glb`
  - `indian-man-with-suit.glb`
- **Environment (`public/assets/models/`)**
  - Buildings (`L_build_1.glb`, `L_build_2.glb`, `L_build_3.glb`, `old_small_house.glb`)
  - Trees (`maple1.glb`, `poplar1.glb`, `whitePoplar1.glb`)
  - Track Elements (`Desert_field.glb`, `MetalRailing.glb`, `StreetLightPoles.glb`)

*Note: All heavy character models have been heavily optimized using Draco compression, deduplication, and WebP textures to fit within a strict <100MB Vercel deployment budget.*

### Art Style Reference
- **Low-Poly & Vibrant:** Clean, baked textures with dynamic lighting.
- **Warm Cinematic Lighting:** Uses a tight shadow frustum and an intense warm directional light to simulate a cinematic sunset glow. 

---

## 5. Technology Stack & Directory Structure
* **Core Framework:** Vue 3 (via Vite)
* **State Management:** Pinia (Installed, unused in favor of reactive App.vue state)
* **3D Rendering Engine:** Three.js (WebGL)
* **Build Tool:** Vite
* **Styling:** CSS / Scoped Vue CSS (Responsive, Mobile-First)
* **Languages:** JavaScript (ES6+), HTML5, CSS3

### Project Architecture & Directory Structure
The project is structured to strictly separate the **3D Game Engine** from the **2D User Interface**, while also handling static assets.

```text
ChargeOn Power Run/
├── docs/
│   ├── initial_implementation_documentation.md # This living document
│   ├── PROCESS_TRACKER.md                      # Detailed changelog and milestones
│   └── IMPLEMENTATION_PLAN.md                  # Strategic architecture plan
├── public/                 # STATIC ASSETS (Served directly by Vite)
│   ├── assets/             # 3D models and textures
│   │   ├── characters/     # Optimized .glb characters + animations.glb
│   │   ├── models/         # Buildings, Trees, Environment
│   │   └── textures/       # Materials and UI images
│   └── audio/              # SFX sprite and music loops
├── scripts/                # Node build utilities (Draco compression, budget checks)
└── src/
    ├── App.vue             # The root Vue component and State Machine controller
    ├── main.js             # Vue application entry point
    ├── style.css           # Global CSS resets and fonts
    ├── data/
    │   └── GameContent.js  # Centralized content (Levels, Features, Pain Points, Dialogues)
    ├── game/               # THREE.JS 3D ENGINE
    │   ├── config/         # GameConfig.js (Tuning constants)
    │   ├── core/           # Engine.js, CameraRig, ObjectPool, QualityManager
    │   ├── entities/       # Player, Pickups, CharacterLoader
    │   ├── systems/        # CollisionSystem, InputManager, EffectsSystem, AudioManager
    │   └── world/          # WorldStreamer, SceneryInstancer, TrackBuilder, SpawnDirector
    └── ui/                 # VUE 2D OVERLAYS
        ├── Landing.vue     # Main menu, Leaderboard, Character Selection
        ├── GameHUD.vue     # Heads-up display (Lives, Progress bar, Coins, Powerups)
        ├── GameOver.vue    # Out of lives screen
        └── ...             # Other narrative and marketing funnel components
```

---

## 6. The Game Loop & State Machine

The entire flow of the application is managed in `App.vue` using a reactive `gameState` variable. The UI Vue components are dynamically mounted/unmounted based on this state, overlaying the persistent 3D `<canvas>` in the background.

**State Flow:**
1. `LANDING`: The user arrives, selects a character, and toggles music. The 3D view shows a lobby with wandering NPCs.
2. `REGISTRATION`: Lead capture form (Name, Company, Email).
3. `HOW_TO_PLAY`: Quick tutorial on mechanics.
4. `STORY_BEAT`: Narrative introduction.
5. `LEVEL_INTRO`: Displays target feature count for the level.
6. `PLAYING`: The 3D Engine is unpaused. The user controls the character. `GameHUD` is active.
7. `LEVEL_COMPLETE`: Triggered when the required number of features is collected.
8. `BOSS_BEAT` -> `OFFER_REVEAL` -> `VICTORY` -> `REDEMPTION`: The end-game marketing funnel.
* *Alternative Flow:* If the player loses 3 lives, the state switches to `GAME_OVER`.

---

## 7. Core Game Mechanics

### Input & Controls
* **Keyboard:** Left/Right Arrow keys or A/D to switch lanes. Up/W to jump, Down/S to slide.
* **Touch:** Swipe Left/Right/Up/Down. Input buffers ensure swipes register smoothly even if the player is mid-animation.

### Procedural Generation (`WorldStreamer.js` & `SceneryInstancer.js`)
* The track is built using an **Object Pool** of reusable chunks. Old chunks behind the camera are moved ahead of the camera to prevent memory leaks and GC stutters.
* **Scenery:** Trees, buildings, and railings are rendered using `InstancedMesh`, reducing thousands of draw calls down to just a handful.
* **Spawning Algorithm (`SpawnDirector.js`):** Coins, Powerups, and Blockers are spawned dynamically based on a weighted difficulty ramp. The director ensures that every obstacle configuration is physically solvable.

### Entities & Collisions
* **Features (Coins):** 3D spinning cylinders. Collecting them pulls from the unique feature queue.
* **Blockers (Obstacles):** BARRICADE_LOW (requires jump), DRONE_LOW (requires slide), DRONE_HIGH (requires lane switch). Hitting these triggers hit-stop, camera shake, red vignette, and removes 1 life.
* **Power-Ups:** Magnets (pulls nearby coins) and Shields (absorbs one hit).

---

## 8. UI & Design Philosophy
* **Responsive Framing:** The 3D camera dynamically solves the FOV to ensure the 3 playable lanes are perfectly framed on all screen sizes, from 4K TVs to portrait phones.
* **Glassmorphism & Blur:** UI elements utilize `backdrop-filter: blur()` and semi-transparent backgrounds to ensure the 3D game world is visible underneath.
* **Typography & UI:** Clean fonts, structured toasts, radial timers for power-ups, and animated score counters via GSAP.
* **CSS Specificity:** Device-specific responsive overrides (e.g. `:global(html[data-size-class="phone-portrait"])`) are used extensively to adjust HUD layouts for mobile.

---

## 9. Audio & Music
* Integrated a highly optimized `AudioManager.js` using a single SFX sprite map (`sfx-sprite.wav`) to minimize HTTP requests.
* Uses `SoundHelix` for a looping music track.
* Supports ducking under stingers (volume lowers when a powerup or hit sound plays) and a master mute button in the Lobby.

---

## 10. Summary of Architectural Upgrades
* **Phase 1-2:** Legacy generation. Procedural building, early State Machine.
* **Phase 3-4 (Milestone 1-3):** Asset Optimization and Responsive Core. Introduced the `WorldStreamer`, `InstancedMesh`, `ViewportManager`, and `CameraRig`. Reduced asset payload from >400MB to <20MB.
* **Phase 5-6 (Milestone 4-6):** Advanced Physics & Entities. Replaced legacy collision with fixed-timestep swept AABB checks. Added Jump/Slide states, sliding hitboxes, and buffered inputs. Added themed power-ups and sequential coin queues.
* **Phase 7-8 (Milestone 7-8):** Characters & UI Polish. Replaced the legacy Soldier with 4 dynamic playable characters and a shared animation rig (`animations.glb`). Added complex UI animations, toasts, and a `PauseMenu`. Fixed CSS responsive regressions.
* **Phase 9 (Milestone 9):** Juice & Immersion. Added hit-stop, camera shake, red vignettes, SFX sprites, and idle attract loops for booth displays. Added 8 new NPC characters for the lobby, rigorously fixing animation rest-pose distortions. Re-compressed the entire character suite via Draco.
