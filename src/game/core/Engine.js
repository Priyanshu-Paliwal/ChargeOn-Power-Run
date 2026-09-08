import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { Player } from "../entities/Player.js";
import { WorldStreamer } from "../world/WorldStreamer.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { viewportManager } from "./ViewportManager.js";
import { CameraRig } from "./CameraRig.js";
import { QualityManager } from "./QualityManager.js";
import GUI from "lil-gui";
import { InputManager } from "../systems/InputManager.js";
import { CollisionSystem } from "../systems/CollisionSystem.js";
import { ScoreSystem } from "../systems/ScoreSystem.js";
import { EffectsSystem } from "../systems/EffectsSystem.js";
import { characterLoader } from "../entities/CharacterLoader.js";
import { audioManager } from "../systems/AudioManager.js";
import { DayNightCycle } from "../systems/DayNightCycle.js";
import { WeatherSystem } from "../systems/WeatherSystem.js";
import {
  HIT_STOP_MS,
  HIT_SHAKE_MAGNITUDE,
  HIT_SHAKE_DURATION,
  HIT_VIBRATE_MS,
  SPEED_KICK_FOV_BOOST,
  SPEED_KICK_DURATION,
  SPEED_LINES_DURATION_MS,
  TUTORIAL_LEVEL_ID,
  TUTORIAL_PATTERN_SEQUENCE,
  TUTORIAL_CHUNK_INDICES,
  LOBBY_PROPS_CONFIG,
} from "../config/GameConfig.js";

export class Engine {
  constructor(canvasContainer, onCollide) {
    this.container = canvasContainer;
    this.onCollide = onCollide || (() => {});
    if (typeof window !== "undefined") window.THREE = THREE;

    // Scene setup - Real Atmosphere
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xd4c9b0, 50, 250); // Natural atmospheric perspective

    // Camera + responsive framing/follow. FOV, aspect, position and lookAt
    // are all owned by CameraRig from here on -- see updateFraming()/update()
    // below, driven by ViewportManager so every screen shape gets a
    // correctly-framed view instead of one fixed FOV.
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
    this.cameraRig = new CameraRig(this.camera);

    // Render quality: picks a starting tier from device signals, and can
    // ratchet down (never up) if sustained FPS is too low. Replaces the old
    // flat "isMobile ? 1 : 1.5" pixel-ratio cutoff.
    this.quality = new QualityManager();

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      antialias: this.quality.tier.antialias,
      powerPreference: "high-performance",
    });

    this.renderer.shadowMap.enabled = this.quality.tier.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.appendChild(this.renderer.domElement);

    // Post-Processing (Highly Optimized for Mobile)
    const renderScene = new RenderPass(this.scene, this.camera);

    // Bloom pass uses a high threshold and softer strength so only emissive materials glow gently.
    // Real size is applied the moment ViewportManager reports the container's
    // actual dimensions (see _onViewportChange below) -- (1,1) here is just
    // a placeholder since EffectComposer.setSize() resizes every pass.
    this.bloomPass = this.quality.tier.bloom
      ? new UnrealBloomPass(new THREE.Vector2(1, 1), 0.25, 0.4, 0.95)
      : null;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(renderScene);
    if (this.bloomPass) this.composer.addPass(this.bloomPass);

    // Clock for delta time
    this.clock = new THREE.Clock();

        // Lights
    const ambientLight = new THREE.AmbientLight(0xfff0dd, 0.2); // Warm ambient
    this.scene.add(ambientLight);
    this.ambientLight = ambientLight;

    // Hemisphere Light for natural character fill and rim lighting
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.45);
    this.scene.add(hemiLight);
    this.hemiLight = hemiLight;

    const dirLight = new THREE.DirectionalLight(0xfffaeb, 1.05); // Warm sunlight directional
    dirLight.position.set(20, 30, 10);
    dirLight.castShadow = this.quality.tier.shadows;

    // Tightly constrain the shadow camera to 40 units around the origin so distant trees don't render into the shadow map
    dirLight.shadow.camera.left = -40;
    dirLight.shadow.camera.right = 40;
    dirLight.shadow.camera.top = 40;
    dirLight.shadow.camera.bottom = -40;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 100;
    dirLight.shadow.bias = -0.001; // Match folio-2025
    dirLight.shadow.normalBias = 0.1; // Match folio-2025
    dirLight.shadow.radius = 3; // Match folio-2025 soft shadows

    dirLight.shadow.mapSize.width = this.quality.tier.shadowMapSize;
    dirLight.shadow.mapSize.height = this.quality.tier.shadowMapSize;
    this.scene.add(dirLight);
    this.dirLight = dirLight;

    // Soft Lobby Spotlight
    const spotLight = new THREE.SpotLight(0xffffff, 0.8);
    spotLight.position.set(0, 10, 5);
    spotLight.angle = Math.PI / 4;
    spotLight.penumbra = 0.5;
    spotLight.decay = 2;
    spotLight.distance = 50;
    spotLight.castShadow = this.quality.tier.shadows;
    this.scene.add(spotLight);

        // --- REAL ATMOSPHERE (SKY & GROUND) ---
    this.initAtmosphere();
    this.initLobbyProps();

    this.dayNightCycle = new DayNightCycle(this);
    this.weatherSystem = new WeatherSystem(this);

    // Input: keyboard + touch, bound to the canvas container (not window) so
    // UI button taps -- captured by the UI layer sitting in front -- never
    // reach these listeners as spurious swipes.
    this.inputManager = new InputManager(this.container);

    // Game Entities
    this.player = new Player(this.scene, this.inputManager);
    this.player.setBoardPreview(false);

    // Warms CharacterLoader's cache for all 4 characters up front (Milestone
    // 7) -- fire-and-forget, deliberately not awaited. The Player construction
    // above already kicked off the DEFAULT character's own load against the
    // same cache, so this only adds the other three; by the time a visitor
    // picks a character on the Lobby screen (which they spend real time on,
    // per the plan), every option is normally already resolved.
    characterLoader.prefetchAll();
    // Load Textures and setup World
    const texLoader = new THREE.TextureLoader();
    const textures = {
      grassDiffuse: texLoader.load("/textures/grass_diffuse.jpg"),
      grassNormal: texLoader.load("/textures/grass_normal.jpg"),
      asphaltNormal: texLoader.load("/textures/asphalt_normal.jpg"),
    };

    // Configure repeating for the ground textures
    textures.grassDiffuse.wrapS = THREE.RepeatWrapping;
    textures.grassDiffuse.wrapT = THREE.RepeatWrapping;
    textures.grassDiffuse.repeat.set(50, 50);

    textures.grassNormal.wrapS = THREE.RepeatWrapping;
    textures.grassNormal.wrapT = THREE.RepeatWrapping;
    textures.grassNormal.repeat.set(50, 50);

    this.models = {};
    this.world = new WorldStreamer(this.scene, textures, this.models, this);
    this.player.onJetpackEnd = () => {
      if (this.world && this.world.clearSkyCoins) {
        this.world.clearSkyCoins();
      }
    };

    this.loadAssets();

    // Viewport contract: one measurement drives camera framing AND
    // renderer/composer sizing together, replacing the old raw
    // `window.addEventListener('resize', ...)` (which read window.innerWidth
    // directly and leaked on dispose() because .bind() returns a new
    // function each time it's called, so removeEventListener never matched
    // the listener that was actually added).
    viewportManager.init(this.container);
    this._unsubscribeViewport = viewportManager.subscribe((state) =>
      this._onViewportChange(state),
    );

    // Animation loop
    this.isRunning = false;

    // AAA Game State
    this.mode = "LOBBY"; // 'LOBBY' or 'PLAYING'

    // Fixed-timestep, swept-interval collision detection -- see
    // CollisionSystem.js for why this replaced a naive per-frame check.
    this.collisionSystem = new CollisionSystem();

    // Score (Milestone 6): engine-owned, fed purely by coin-hit events --
    // persists across level transitions the same way gameStats.featuresCollected
    // does on the Vue side, reset only by resetRun().
    this.scoreSystem = new ScoreSystem();

    // Coin-pickup particle bursts (Milestone 9 juice) -- one shared
    // InstancedMesh pool, see EffectsSystem.js.
    this.effectsSystem = new EffectsSystem(this.scene);

    // Hitstop (Milestone 9): a real blocker hit sets this to a near-future
    // timestamp; animate() clamps delta to 0 for every frame until then,
    // freezing the whole simulation for a brief, punchy impact beat without
    // any system needing its own pause-awareness.
    this._hitStopUntil = 0;

    // Speed-lines overlay window (Milestone 9), set by startLevel() --
    // GameHUD.vue polls isSpeedLinesActive the same way it polls power-up
    // state, since this is also a transient timed visual, not
    // event-driven gameStats.
    this._speedLinesUntil = 0;

    // Interactive tutorial (Milestone 9): once per RUN, not once per
    // Level-1 visit -- a mid-run "Restart Level" from PauseMenu on Level 1
    // must not re-trigger it (already shown moments ago in this same run).
    // Only resetRun() (called from App.vue's quitToLobby(), i.e. a
    // genuinely fresh run) clears this back to false.
    this._tutorialShownThisRun = false;
  }

  // Wraps World.setLevel() with the speed-up juice that belongs at every
  // level transition (FOV kick + speed lines) -- App.vue calls this
  // instead of reaching into gameEngine.world.setLevel() directly, so
  // every call site (a fresh level start AND a Pause-menu level restart)
  // gets the juice automatically instead of each caller remembering to
  // trigger it separately. Also the sole trigger point for the Level-1
  // interactive tutorial, for the same "one call site, never forgotten"
  // reason.
  startLevel(levelId) {
    this.world.setLevel(levelId);
    this.player.lives = 3;
    this.player._cancelHitReaction?.();
    this.player._invulnerableTimer = 0;
    this.cameraRig.triggerFovKick(SPEED_KICK_FOV_BOOST, SPEED_KICK_DURATION);
    this._speedLinesUntil = performance.now() + SPEED_LINES_DURATION_MS;

    if (levelId === TUTORIAL_LEVEL_ID && !this._tutorialShownThisRun) {
      this._tutorialShownThisRun = true;
      this.world.startTutorial(
        TUTORIAL_PATTERN_SEQUENCE,
        TUTORIAL_CHUNK_INDICES,
      );
    }

    // Fill the empty chunks so the track isn't totally blank at the start
    this.world.populateInitialTrack();
  }

  get isSpeedLinesActive() {
    return performance.now() < this._speedLinesUntil;
  }

  // Called by App.vue's quitToLobby() (renamed from restartGame() in
  // Milestone 8) -- resets everything the engine owns that would
  // otherwise silently carry over into a fresh run (score, the pre-
  // existing but otherwise-unused player.lives counter, and whether the
  // Level 1 tutorial has already been shown this run).
  resetRun() {
    this.scoreSystem.reset();
    this.player.lives = 3;
    this.player._cancelHitReaction?.();
    this.player._invulnerableTimer = 0;
    this._tutorialShownThisRun = false;
    this.player.hasBoard = false;
    this.player.setBoardPreview(false);
    this.player.boardMesh.visible = false;
    if (this.player.model) this.player.model.position.y = 0;
    if (this.world && this.world.clearSkyCoins) {
      this.world.clearSkyCoins();
    }
  }

  // Wraps CollisionSystem's raw onHit payload: activates power-ups and
  // updates score BEFORE forwarding to Vue, so gameStats always receives an
  // already-enriched payload (score total, power-up outcome) rather than
  // Vue needing to know anything about ScoreSystem or Player internals.
  _handleHit(hit) {
    if (hit.type === "coin") {
      const result = this.scoreSystem.registerCoin(hit);
      if (hit.powerUp === "magnet")
        this.player.activateMagnet(hit.powerUpDurationMs);
      else if (hit.powerUp === "shield") this.player.activateShield();
      else if (hit.powerUp === "jetpack" || hit.name === "Jetpack") {
        this.player.activateJetpack(hit.powerUpDurationMs || 6000);
        if (this.world && this.world.spawnJetpackSkyCoins) {
          this.world.spawnJetpackSkyCoins();
        }
      } else if (hit.powerUp === "board")
        this.player.activateBoard(hit.powerUpDurationMs);
      audioManager.playSFX(hit.powerUp ? "powerup" : "coin");
      if (hit.worldPosition) {
        this.effectsSystem.burst(
          hit.worldPosition,
          hit.powerUp === "shield" || hit.powerUp === "board" ? 0x00e5ff : 0xffd700,
        );
      }
      // worldPosition is a shared mutable scratch vector (see
      // CollisionSystem's comment) -- must NOT reach Vue's reactive
      // gameStats, which is why it's excluded here rather than spread
      // through along with everything else.
      const { worldPosition, ...vueHit } = hit;
      this.onCollide({ ...vueHit, score: result.total, points: result.points });
    } else if (hit.type === "board_saved") {
      audioManager.playSFX("shield");
      if (this.player?.mesh?.position) {
        this.effectsSystem.burst(this.player.mesh.position, 0x00e5ff);
      }
      this.cameraRig.triggerShake(HIT_SHAKE_MAGNITUDE * 0.6, HIT_SHAKE_DURATION * 0.6);
      this.onCollide({ ...hit, score: this.scoreSystem.score, points: 0 });
    } else if (hit.type === "shielded") {
      audioManager.playSFX("shield");
      this.onCollide({ ...hit, score: this.scoreSystem.score, points: 0 });
    } else if (hit.type === "blocker") {
      const penaltyResult = this.scoreSystem.registerObstacleHit(hit.obstacleType);
      audioManager.playSFX("hit");
      // Hitstop + camera shake + haptics -- the "impact" side of hit juice.
      // The stumble animation and red flash are Player.js's own job
      // (already existed / see takeHit()), triggered independently by
      // CollisionSystem calling player.takeHit() before this ever runs.
      this._hitStopUntil = performance.now() + HIT_STOP_MS;
      this.cameraRig.triggerShake(HIT_SHAKE_MAGNITUDE, HIT_SHAKE_DURATION);
      if (navigator.vibrate) navigator.vibrate(HIT_VIBRATE_MS);
      this.onCollide({ ...hit, score: penaltyResult.total, points: penaltyResult.points });
    } else if (hit.type === "nearmiss") {
      const result = this.scoreSystem.registerNearMiss();
      audioManager.playSFX("nearmiss");
      this.onCollide({ ...hit, score: result.total, points: result.points });
    } else {
      this.onCollide(hit);
    }
  }

  _onViewportChange(state) {
    this.cameraRig.updateFraming(state);
    const { width, height, pixelRatio } =
      this.quality.computeRendererSize(state);
    this._applyRendererSize(width, height, pixelRatio);
  }

  _applyRendererSize(width, height, pixelRatio) {
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false); // false: CSS owns the canvas's display box
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
  }

  // Applies a newly-downgraded quality tier's settings to things that can
  // change after construction. `antialias` is deliberately absent here --
  // it's a WebGLRenderer constructor-only option.
  _applyQualityTier() {
    const tier = this.quality.tier;

    this.renderer.shadowMap.enabled = tier.shadows;
    this.dirLight.castShadow = tier.shadows;
    if (tier.shadows) {
      this.dirLight.shadow.mapSize.set(tier.shadowMapSize, tier.shadowMapSize);
      this.dirLight.shadow.map?.dispose();
      this.dirLight.shadow.map = null;
    }

    if (this.bloomPass) this.bloomPass.enabled = tier.bloom;

    const state = viewportManager.getState();
    if (state) this._onViewportChange(state);
  }

  async loadAssets() {
    const gltfLoader = new GLTFLoader();
    // Milestone 1's optimizeAssets.js Draco-compresses every environment/
    // tree/building GLB (trees, railings, streetlights, buildings, the
    // desert ground) -- without a DRACOLoader attached, GLTFLoader throws
    // "No DRACOLoader instance provided" and silently fails to parse EVERY
    // one of them (caught by each loadModel/loadBuilding call's own
    // try/catch below, which only console.error()s -- nothing ever
    // surfaced this visually, so the scene just rendered with none of them
    // ever added). The Milestone 7 character models load fine without this
    // because they were exported directly via three.js's GLTFExporter with
    // no Draco compression at all -- a different pipeline, which is why
    // only the player character was ever visible. Decoder files are served
    // locally from public/draco/ (copied from three's own node_modules)
    // rather than three's default gstatic.com CDN path, consistent with
    // this project's "never depend on a remote resource the booth wifi
    // might not reach" rule (see the SoundHelix removal in Milestone 9).
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("/draco/");
    gltfLoader.setDRACOLoader(dracoLoader);
    const fbxLoader = new FBXLoader();
    const texLoader = new THREE.TextureLoader();

    const setupModel = (model) => {
      if (!model) return null;
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => (m.roughness = 0.8));
            } else {
              child.material.roughness = 0.8;
            }
          }
        }
      });
      return model;
    };

    const loadModel = async (key, url, customSetup = setupModel) => {
      try {
        const gltf = await gltfLoader.loadAsync(url);
        if (gltf && gltf.scene) {
          this.models[key] = customSetup(gltf.scene);
          if (gltf.animations && gltf.animations.length > 0) {
            this.models[key].animations = gltf.animations; // Store embedded animations directly on the scene object
          }
        }
      } catch (err) {
        console.error(`Failed to load GLTF ${url}:`, err);
      }
    };

    const loadFBXModel = async (key, url, customSetup = setupModel) => {
      try {
        const fbx = await fbxLoader.loadAsync(url);
        if (fbx) {
          // FBX scales differently sometimes, standard scale adjustment (0.01) may be needed, but we'll let customSetup handle it if needed
          this.models[key] = customSetup(fbx);
          if (fbx.animations && fbx.animations.length > 0) {
            this.models[key].animations = fbx.animations;
          }
        }
      } catch (err) {
        console.error(`Failed to load FBX ${url}:`, err);
      }
    };

    const loadBuilding = async (key, glbUrl, texFolder, prefix) => {
      try {
        const gltf = await gltfLoader.loadAsync(glbUrl);
        const [colorMap, normalMap, roughnessMap] = await Promise.all([
          texLoader.loadAsync(`${texFolder}/${prefix}_Base_Color.webp`),
          texLoader.loadAsync(`${texFolder}/${prefix}_Normal.webp`),
          texLoader.loadAsync(`${texFolder}/${prefix}_Roughness.webp`),
        ]);

        colorMap.flipY = false;
        colorMap.colorSpace = THREE.SRGBColorSpace;
        normalMap.flipY = false;
        roughnessMap.flipY = false;

        const model = gltf.scene;
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            child.material = new THREE.MeshStandardMaterial({
              map: colorMap,
              normalMap: normalMap,
              roughnessMap: roughnessMap,
              roughness: 1.0,
              metalness: 0.1,
            });
          }
        });
        this.models[key] = model;
      } catch (err) {
        console.error(`Failed to load building ${key}:`, err);
      }
    };

    const createStreetLight = () => {
      const group = new THREE.Group();

      const poleMat = new THREE.MeshStandardMaterial({
        color: 0x111111, // Dark grey/black pole color
        metalness: 0.8,
        roughness: 0.2,
      });

      // Base
      const baseGeo = new THREE.CylinderGeometry(0.2, 0.5, 1, 16);
      const base = new THREE.Mesh(baseGeo, poleMat);
      base.position.y = 0.5;
      base.castShadow = true;
      base.receiveShadow = true;
      group.add(base);

      // Main Pole
      const poleGeo = new THREE.CylinderGeometry(0.2, 0.2, 6, 16);
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.y = 4;
      pole.castShadow = true;
      pole.receiveShadow = true;
      group.add(pole);

      // Arm
      const armGeo = new THREE.CylinderGeometry(0.1, 0.1, 2.5, 16);
      const arm = new THREE.Mesh(armGeo, poleMat);
      arm.rotation.z = Math.PI / 2;
      arm.position.set(-1, 6.3, 0);
      arm.castShadow = true;
      arm.receiveShadow = true;
      group.add(arm);

      // Lamp Head
      const lampGeo = new THREE.BoxGeometry(0.6, 0.15, 0.3);
      const lamp = new THREE.Mesh(lampGeo, poleMat);
      lamp.position.set(-2, 6.3, 0);
      lamp.castShadow = true;
      lamp.receiveShadow = true;
      group.add(lamp);

      // Bulb (Glowing)
      const bulbGeo = new THREE.SphereGeometry(0.12, 8, 8);
      // Emissive material for bloom pass
      const bulbMat = new THREE.MeshStandardMaterial({
        color: 0xffff88,
        emissive: 0xffff88,
        emissiveIntensity: 2.0, // Strong emissive for UnrealBloomPass
      });
      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      bulb.position.set(-2, 6.2, 0);
      group.add(bulb);

      return group;
    };

    this.models["streetlight"] = createStreetLight();

    await Promise.all([
      loadModel(
        "PublicBuilding_1",
        "/assets/models/buildings/PublicBuilding_1.glb",
      ),
      loadModel(
        "PublicBuilding_2",
        "/assets/models/buildings/PublicBuilding_2.glb",
      ),
      loadModel(
        "PublicBuilding_3",
        "/assets/models/buildings/PublicBuilding_3.glb",
      ),
      loadModel(
        "PublicBuilding_4",
        "/assets/models/buildings/PublicBuilding_4.glb",
      ),
      loadModel(
        "PublicBuilding_5",
        "/assets/models/buildings/PublicBuilding_5.glb",
      ),
      loadModel(
        "PublicBuilding_6",
        "/assets/models/buildings/PublicBuilding_6.glb",
      ),
      loadModel(
        "PublicBuilding_7",
        "/assets/models/buildings/PublicBuilding_7.glb",
      ),
      loadModel(
        "PublicBuilding_8",
        "/assets/models/buildings/PublicBuilding_8.glb",
      ),
      loadModel(
        "PublicBuilding_9",
        "/assets/models/buildings/PublicBuilding_9.glb",
      ),
      loadModel(
        "PublicBuilding_10",
        "/assets/models/buildings/PublicBuilding_10.glb",
      ),
      loadModel(
        "RestaurantBuilding",
        "/assets/models/buildings/RestaurantBuilding.glb",
      ),
      loadModel("ShopBuilding", "/assets/models/buildings/ShopBuilding.glb"),
      loadModel("PizzaBuilding", "/assets/models/buildings/PizzaBuilding.glb"),
      loadModel(
        "BurgerBuilding",
        "/assets/models/buildings/BurgerBuilding.glb",
      ),
      loadModel("CafeBuilding", "/assets/models/buildings/CafeBuilding.glb"),
      loadModel(
        "ShoppingCenterBuilding",
        "/assets/models/buildings/ShoppingCenterBuilding.glb",
      ),
      loadModel("Cinema", "/assets/models/buildings/Cinema.glb"),
      loadModel("jetpack", "/assets/JetpackModel/JetpackModel.gltf"),
      loadModel("board", "/assets/skateboard.glb"),
      loadModel("railing", "/assets/models/environment/MetalRailing.glb"),
      loadModel("airport_plant", "/assets/models/trees/airport_plant.glb"),// Footpath props
      loadModel("atm", "/assets/models/environment/props/atm.glb"),
      loadModel(
        "bench",
        "/assets/models/environment/bench_folio.glb",
        (scene) => {
          let benchMesh = null;
          scene.traverse((child) => {
            if (child.isMesh && !benchMesh) {
              benchMesh = child.clone();
            }
          });

          if (benchMesh) {
            const group = new THREE.Group();

            // Reset the world offset baked into Bruno's scene
            benchMesh.position.set(0, 0, 0);
            benchMesh.rotation.set(0, 0, 0);
            benchMesh.scale.set(1, 1, 1);

            // Load the folio palette
            const paletteTex = texLoader.load("/textures/palette.png");
            paletteTex.minFilter = THREE.NearestFilter;
            paletteTex.magFilter = THREE.NearestFilter;
            paletteTex.colorSpace = THREE.SRGBColorSpace;
            paletteTex.flipY = false;

            benchMesh.material = new THREE.MeshStandardMaterial({
              map: paletteTex,
              roughness: 0.9,
            });

            benchMesh.castShadow = true;
            benchMesh.receiveShadow = true;

            group.add(benchMesh);
            return group;
          }
          return setupModel(scene);
        },
      ),
      loadModel("bus_stop", "/assets/models/environment/props/bus_stop.glb"),
      loadModel(
        "coffee_food_cart",
        "/assets/models/environment/props/coffee_food_cart.glb",
      ),
      loadModel("hydrant", "/assets/models/environment/props/hydrant.glb"),
      loadModel(
        "ice_cream_food_cart",
        "/assets/models/environment/props/ice_cream_food_cart.glb",
      ),
      loadModel("manhole", "/assets/models/environment/props/manhole.glb"),
      loadModel("pallet", "/assets/models/environment/props/pallet.glb"),
      loadModel("postbox", "/assets/models/environment/props/postbox.glb"),
      loadModel("stop_sign", "/assets/models/environment/props/stop_sign.glb"),
      loadModel(
        "storm_drain",
        "/assets/models/environment/props/storm_drain.glb",
      ),
      loadModel(
        "trash_large",
        "/assets/models/environment/props/trash_large.glb",
      ),
      loadModel(
        "trash_small",
        "/assets/models/environment/props/trash_small.glb",
      ),
      loadModel(
        "utility_box",
        "/assets/models/environment/props/utility_box.glb",
      ),
      loadModel("airdancer", "/assets/models/environment/airdancer.glb"),

      // ----- Native Characters (with embedded animations) -----
      loadModel(
        "npc_businessman",
        "/assets/characters/businessman_character_ankit_rigged.glb",
        (scene) => {
          scene.scale.set(1.5, 1.5, 1.5);
          return setupModel(scene);
        },
      ),
      loadModel(
        "npc_thalapathy",
        "/assets/characters/thalapathy_vijay_3d_model.glb",
        (scene) => {
          scene.scale.set(1.5, 1.5, 1.5);
          return setupModel(scene);
        },
      ),
      loadModel(
        "npc_indian_man",
        "/assets/characters/indian-man-with-suit.glb",
        (scene) => {
          scene.scale.set(1.5, 1.5, 1.5);
          return setupModel(scene);
        },
      ),
      loadModel("npc_dog", "/assets/characters/dog/source/dog.glb", (scene) => {
        // Dog natively might be right sized, scaling to 1.0 just in case.
        scene.scale.set(1.0, 1.0, 1.0);
        return setupModel(scene);
      }),
      loadModel(
        "npc_flamingo",
        "/assets/characters/flamingo/source/Flamingo.glb",
        (scene) => {
          scene.scale.set(0.005, 0.005, 0.005); // Flamingo usually big
          return setupModel(scene);
        },
      ),
      loadFBXModel(
        "npc_female_phone",
        "/assets/characters/female-phone-walking-free-animation-40f-loop/source/extracted/locom_f_phoneWalking_40f.fbx",
        (scene) => {
          scene.scale.set(0.015, 0.015, 0.015);
          return setupModel(scene);
        },
      ),
      loadFBXModel(
        "npc_male_basic",
        "/assets/characters/male-basic-walk-30-frames-loop/source/extracted/locom_m_basicWalk_30f.fbx",
        (scene) => {
          scene.scale.set(0.015, 0.015, 0.015);
          return setupModel(scene);
        },
      ),
      loadFBXModel(
        "npc_male_phone",
        "/assets/characters/male-phone-walking-40-frames-loop/source/extracted/locom_m_phoneWalking_40f.fbx",
        (scene) => {
          scene.scale.set(0.015, 0.015, 0.015);
          return setupModel(scene);
        },
      ),
      loadFBXModel(
        "npc_male_slow",
        "/assets/characters/male-slow-walk-40-frames-loop/source/extracted/locom_m_slowWalk_40f.fbx",
        (scene) => {
          scene.scale.set(0.015, 0.015, 0.015);
          return setupModel(scene);
        },
      ),
      loadModel(
        "npc_ps1_male",
        "/assets/characters/male_character_ps1-style.glb",
        (scene) => {
          scene.scale.set(1.3, 1.3, 1.3); // Increased scale as requested
          return setupModel(scene);
        },
      ),
    ]);

    // Desert model removed - it rendered as a white/snowy landscape that washed out the track visuals.
    // The ground plane in initAtmosphere() provides the base green ground like the reference game.

    // Wait for the main character models and animations to finish loading
    const [animations] = await Promise.all([characterLoader.loadAnimations()]);

    try {
      const thalapathyModel = this.models["npc_thalapathy"];
      const businessmanModel = this.models["npc_businessman"];
      const ps1Model = this.models["npc_ps1_male"];
      const malePhoneModel = this.models["npc_male_phone"];
      const femalePhoneModel = this.models["npc_female_phone"];
      const indianManModel = this.models["npc_indian_man"];

      const thalapathyBones = [];
      if (thalapathyModel) {
        if (!thalapathyModel.animations) thalapathyModel.animations = [];
        thalapathyModel.traverse((c) => {
          if (c.isBone) thalapathyBones.push(c.name);
        });
      }

      const businessmanBones = [];
      if (businessmanModel) {
        if (!businessmanModel.animations) businessmanModel.animations = [];
        businessmanModel.traverse((c) => {
          if (c.isBone) businessmanBones.push(c.name);
        });
      }

      const ps1Bones = [];
      if (ps1Model) {
        if (!ps1Model.animations) ps1Model.animations = [];
        ps1Model.traverse((c) => {
          if (c.isBone) ps1Bones.push(c.name);
        });
      }

      const malePhoneBones = [];
      if (malePhoneModel) {
        if (!malePhoneModel.animations) malePhoneModel.animations = [];
        malePhoneModel.traverse((c) => {
          if (c.isBone) malePhoneBones.push(c.name);
        });
      }

      const femalePhoneBones = [];
      if (femalePhoneModel) {
        if (!femalePhoneModel.animations) femalePhoneModel.animations = [];
        femalePhoneModel.traverse((c) => {
          if (c.isBone) femalePhoneBones.push(c.name);
        });
      }

      const indianManBones = [];
      if (indianManModel) {
        if (!indianManModel.animations) indianManModel.animations = [];
        indianManModel.traverse((c) => {
          if (c.isBone) indianManBones.push(c.name);
        });
      }

      // Strip root motion from phone models' embedded Take 001
      const stripRootMotion = (model) => {
        if (model && model.animations) {
          model.animations.forEach((anim) => {
            anim.tracks = anim.tracks.filter(
              (t) =>
                !t.name.includes("rig_CharRoot.position") &&
                !t.name.includes("bip.position") &&
                !t.name.includes("bip_Pelvis.position"),
            );
          });
        }
      };
      stripRootMotion(femalePhoneModel);
      stripRootMotion(malePhoneModel);

      if (
        thalapathyModel ||
        businessmanModel ||
        ps1Model ||
        malePhoneModel ||
        femalePhoneModel ||
        indianManModel
      ) {
        const motionFiles = [
          "jogging.fbx",
          "Looking.fbx",
          "Pacing_And_Talking_On_A_Phone_backwards_forwards.fbx",
          "Sitting_clap.fbx",
          "sitting_leg_movement.fbx",
          "strut_walking.fbx",
          "talking_phone_pacing.fbx",
          "walking.fbx",
          "walking_while_texting.fbx",
          "Waving.fbx",
        ];

        const retargetClip = (clip, targetBones, model) => {
          const retargetedTracks = [];
          const unmatched = new Set();
          clip.tracks.forEach((track) => {
            const parts = track.name.split(".");
            const origBone = parts[0];
            const prop = parts[1];

            // Handle 'mixamorig:', 'mixamorig', 'mixamorig_' etc.
            let coreName = origBone.replace(/mixamorig[:_]?/gi, "");

            let searchName = coreName;

            // PS1 Custom Mapping Dictionary
            if (model === ps1Model) {
              const ps1Map = {
                Hips: "pelvis",
                Spine: "spine",
                Spine1: "chest",
                Spine2: "chest",
                Neck: "neck",
                Head: "head",
                LeftShoulder: "shoulder_left",
                LeftArm: "upper_arm_left",
                LeftForeArm: "forearm_left",
                LeftHand: "hand_left",
                RightShoulder: "shoulder_right",
                RightArm: "upper_arm_right",
                RightForeArm: "forearm_right",
                RightHand: "hand_right",
                LeftUpLeg: "thigh_left",
                LeftLeg: "shin\\.L",
                LeftFoot: "foot_left",
                RightUpLeg: "thigh_right",
                RightLeg: "shin\\.R",
                RightFoot: "foot_right",
              };
              if (ps1Map[coreName]) searchName = ps1Map[coreName];
            }

            // Male Phone and Female Phone Custom Mapping Dictionary (Biped)
            if (model === malePhoneModel || model === femalePhoneModel) {
              const bipedMap = {
                Hips: "bip_Pelvis",
                Spine: "bip_Spine",
                Spine1: "bip_Spine1",
                Spine2: "bip_Spine1", // No Spine2 in bip
                Neck: "bip_Neck",
                Head: "bip_Head",
                LeftShoulder: "bip_L_Clavicle",
                LeftArm: "bip_L_UpperArm",
                LeftForeArm: "bip_L_Forearm",
                LeftHand: "bip_L_Hand",
                RightShoulder: "bip_R_Clavicle",
                RightArm: "bip_R_UpperArm",
                RightForeArm: "bip_R_Forearm",
                RightHand: "bip_R_Hand",
                LeftUpLeg: "bip_L_Thigh",
                LeftLeg:
                  "(bip_L_Calf|bip_L_Shin|bip_L_Knee|bip_L_Leg|bip_L_LowerLeg)",
                LeftFoot: "bip_L_Foot",
                LeftToeBase: "(bip_L_Toe0|bip_L_Toe)",
                RightUpLeg: "bip_R_Thigh",
                RightLeg:
                  "(bip_R_Calf|bip_R_Shin|bip_R_Knee|bip_R_Leg|bip_R_LowerLeg)",
                RightFoot: "bip_R_Foot",
                RightToeBase: "(bip_R_Toe0|bip_R_Toe)",
              };
              if (bipedMap[coreName]) searchName = bipedMap[coreName];
            }

            // Match the core name exactly, or with any trailing characters like _01, _02, etc.
            // AND optionally allow the 'mixamorig:' prefix for standard FBX models!
            const regex = new RegExp(
              `^(mixamorig[:_]?)?${searchName}(.*)$`,
              "i",
            );
            const matchingBone = targetBones.find((b) => regex.test(b));

            if (matchingBone) {
              if (prop === "quaternion") {
                const newTrack = track.clone();
                newTrack.name = matchingBone + "." + prop;

                // If this is a Z-up model (like PS1) and it's the root bone (pelvis/hips),
                // we must PRESERVE the rest rotation, otherwise it gets forced to Identity and lies down!
                if (
                  (model === ps1Model && matchingBone === "pelvis_01") ||
                  ((model === malePhoneModel || model === femalePhoneModel) &&
                    matchingBone === "bip_Pelvis")
                ) {
                  const boneObj = model.getObjectByName(matchingBone);
                  if (boneObj) {
                    const restQ = boneObj.quaternion.clone();
                    for (let i = 0; i < newTrack.values.length; i += 4) {
                      const animQ = new THREE.Quaternion(
                        newTrack.values[i],
                        newTrack.values[i + 1],
                        newTrack.values[i + 2],
                        newTrack.values[i + 3],
                      );
                      // Pre-multiply the rest rotation so it stays standing!
                      const finalQ = restQ.clone().multiply(animQ);
                      newTrack.values[i] = finalQ.x;
                      newTrack.values[i + 1] = finalQ.y;
                      newTrack.values[i + 2] = finalQ.z;
                      newTrack.values[i + 3] = finalQ.w;
                    }
                  }
                }

                retargetedTracks.push(newTrack);
              } else if (prop === "position") {
                const newTrack = track.clone();
                newTrack.name = matchingBone + "." + prop;

                // Dynamically scale position data so the character doesn't fly off screen
                let targetRestX = 0.0;
                let targetRestY = 1.0;
                let targetRestZ = 0.0;
                const boneObj = model.getObjectByName(matchingBone);
                if (boneObj) {
                  targetRestX = boneObj.position.x;
                  targetRestY = boneObj.position.y;
                  targetRestZ = boneObj.position.z;
                }

                // Detect if the target skeleton is Z-up (like PS1 male) instead of Y-up
                const isZUp = Math.abs(targetRestZ) > Math.abs(targetRestY);

                let animRestX = newTrack.values[0] || 0.0;
                let animRestY = newTrack.values[1] || 1.0;
                let animRestZ = newTrack.values[2] || 0.0;
                if (animRestY === 0) animRestY = 1.0;

                let targetUpRest = isZUp ? targetRestZ : targetRestY;
                let scaleRatio = Math.abs(targetUpRest / animRestY);

                // Preserve full hip sway (X, Y, Z) but centered around the target's rest position!
                for (let i = 0; i < newTrack.values.length; i += 3) {
                  let mixamoX = newTrack.values[i];
                  let mixamoY = newTrack.values[i + 1];
                  let mixamoZ = newTrack.values[i + 2];

                  let swayX = (mixamoX - animRestX) * scaleRatio;
                  let bobbing = (mixamoY - animRestY) * scaleRatio;
                  let rawSwayZ = (mixamoZ - animRestZ) * scaleRatio;

                  // Strip the macroscopic forward root motion for continuous walking/jogging
                  // animations, so they loop perfectly in-place as the engine pushes them.
                  // HOWEVER, for complex local animations (like pacing, talking, turning around),
                  // we PRESERVE the local root motion so they actually step around in their spot!
                  let swayZ = 0;
                  const nameLower = clip.name.toLowerCase();
                  if (
                    nameLower.includes("pacing") ||
                    nameLower.includes("talking") ||
                    nameLower.includes("waving") ||
                    nameLower.includes("sit") ||
                    nameLower.includes("looking")
                  ) {
                    swayZ = rawSwayZ;
                  }

                  if (isZUp) {
                    newTrack.values[i] = targetRestX + swayX;
                    newTrack.values[i + 1] = targetRestY - swayZ;
                    newTrack.values[i + 2] = targetRestZ + bobbing;
                  } else {
                    newTrack.values[i] = targetRestX + swayX;
                    newTrack.values[i + 1] = targetRestY + bobbing;
                    newTrack.values[i + 2] = targetRestZ + swayZ;
                  }
                }

                retargetedTracks.push(newTrack);
              }
            } else {
              unmatched.add(origBone);
            }
          });

          if (unmatched.size > 0) {
            // console.warn(
            //   `[Retargeting] ${clip.name} unmatched bones:`,
            //   Array.from(unmatched).join(", "),
            // );
          }

          clip.tracks = retargetedTracks;
          return clip;
        };

        // Process embedded animations to strip Root Motion and make them "In-Place"!
        const processEmbeddedAnims = (model, bones) => {
          if (!model || !model.animations) return;
          const newAnims = [];
          for (const clip of model.animations) {
            const retargeted = retargetClip(clip.clone(), bones, model);
            newAnims.push(retargeted);
          }
          model.animations = newAnims;
        };

        processEmbeddedAnims(thalapathyModel, thalapathyBones);
        processEmbeddedAnims(businessmanModel, businessmanBones);
        processEmbeddedAnims(ps1Model, ps1Bones);
        processEmbeddedAnims(indianManModel, indianManBones);
        // processEmbeddedAnims(malePhoneModel, malePhoneBones); // Temporarily disable to stop freezing

        if (malePhoneModel) {
          // console.log("Male Phone Bones length:", malePhoneBones.length);
        }

        for (const file of motionFiles) {
          try {
            const fbx = await fbxLoader.loadAsync(
              `/assets/characters/motions/${file}`,
            );
            if (fbx.animations && fbx.animations.length > 0) {
              const clip = fbx.animations[0];
              clip.name = file.replace(".fbx", "");

              if (thalapathyModel) {
                // Pass a cloned clip so we don't mutate the original before the next character needs it!
                const retargeted = retargetClip(
                  clip.clone(),
                  thalapathyBones,
                  thalapathyModel,
                );
                thalapathyModel.animations.push(retargeted);
                // console.log(`[Retargeting] Applied ${clip.name} to Thalapathy`);
              }

              if (businessmanModel) {
                const retargeted = retargetClip(
                  clip.clone(),
                  businessmanBones,
                  businessmanModel,
                );
                businessmanModel.animations.push(retargeted);
                // console.log(
                //   `[Retargeting] Applied ${clip.name} to Businessman`,
                // );
              }
              if (ps1Model) {
                const retargeted = retargetClip(
                  clip.clone(),
                  ps1Bones,
                  ps1Model,
                );
                ps1Model.animations.push(retargeted);
                // console.log(`[Retargeting] Applied ${clip.name} to PS1 Male`);
              }

              if (malePhoneModel) {
                const retargeted = retargetClip(
                  clip.clone(),
                  malePhoneBones,
                  malePhoneModel,
                );
                malePhoneModel.animations.push(retargeted);
                // console.log(`[Retargeting] Applied ${clip.name} to Male Phone`);
              }
              if (femalePhoneModel) {
                const retargeted = retargetClip(
                  clip.clone(),
                  femalePhoneBones,
                  femalePhoneModel,
                );
                femalePhoneModel.animations.push(retargeted);
                // console.log(
                //   `[Retargeting] Applied ${clip.name} to Female Phone`,
                // );
              }
              if (indianManModel) {
                const retargeted = retargetClip(
                  clip.clone(),
                  indianManBones,
                  indianManModel,
                );
                indianManModel.animations.push(retargeted);
                // console.log(`[Retargeting] Applied ${clip.name} to Indian Man`);
              }
            }
          } catch (err) {
            console.error(`Failed to load/retarget motion ${file}:`, err);
          }
        }
      }
    } catch (e) {
      console.error("Retargeting Error:", e);
    }
    // ==============================================

    // Inject the animations into WorldStreamer so it can pass them to FootpathPropSystem
    if (this.world) {
      this.world.propSystem.animations = animations; // Core mixamo animations (Run, Idle, etc)
      this.world.buildScenery();
    }
  }

  initAtmosphere() {
    // Disabled Sky.js procedural scattering to fix intense whiteout/bloom issues.
    // DayNightCycle.js will now handle the sun mesh, moon mesh, and sky background color.

    // Load HDRI for reflections only (not background)
    new RGBELoader()
      .setPath("/textures/")
      .load("venice_sunset_1k.hdr", (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        // Keep environment for realistic reflections on coins/character
        this.scene.environment = texture;
      });

    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0; // Restored normal exposure since Sky.js whiteout is gone

    // 2. Endless Ground - sand/dirt base replacing the old green base
    const texLoader = new THREE.TextureLoader();
    const sandTex = texLoader.load("/textures/sand.jpg");
    sandTex.wrapS = THREE.RepeatWrapping;
    sandTex.wrapT = THREE.RepeatWrapping;
    // The ground is 2000x2000, repeating 200 times makes each tile 10x10 units
    sandTex.repeat.set(200, 200);
    sandTex.colorSpace = THREE.SRGBColorSpace;

    const groundGeo = new THREE.PlaneGeometry(2000, 2000);
    this.groundMat = new THREE.MeshStandardMaterial({
      map: sandTex,
      roughness: 0.95,
      metalness: 0.0,
    });

    const ground = new THREE.Mesh(groundGeo, this.groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.15; // Just below the track
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  initLobbyProps() {
    this.lobbyPropsGroup = new THREE.Group();
    this.lobbyPropsGroup.name = "LobbyPropsGroup";
    this.scene.add(this.lobbyPropsGroup);
  }

  setMode(newMode) {
    this.mode = newMode;
    if (this.lobbyPropsGroup) {
      this.lobbyPropsGroup.visible = newMode === "LOBBY";
    }
    if (this.mode === "LOBBY") {
      this.player.setAnimation("Idle");
      this.player.setFacing(0); // Face the camera
      this.player.hasBoard = false;
      this.player.setBoardPreview(false);
      this.player.boardMesh.visible = false;
      if (this.player.model) this.player.model.position.y = 0;
    } else if (this.mode === "PLAYING") {
      this.player.setAnimation(this.player.hasBoard ? "Surfing" : "Run");
      this.player.setFacing(Math.PI); // Face the track
      this.player.setBoardPreview(false);
    } else if (this.mode === "VICTORY") {
      this.player.hasBoard = false;
      this.player.setBoardPreview(false);
      this.player.boardMesh.visible = false;
      if (this.player.model) this.player.model.position.y = 0;
      this.player.mesh.position.x = 0;
      this.player.targetX = 0;
      this.player.currentLane = 1;
      this.player.setFacing(0); // Face the camera
      this.player.playSequence(["Victory_idle", "victory_jump"], true);
    } else if (this.mode === "DEFEAT") {
      this.player.hasBoard = false;
      this.player.setBoardPreview(false);
      this.player.boardMesh.visible = false;
      if (this.player.model) this.player.model.position.y = 0;
      this.player.mesh.position.x = 0;
      this.player.targetX = 0;
      this.player.currentLane = 1;
      this.player.setFacing(0); // Face the camera
      this.player.playSequence(["Defeat", "Defeated"], true);
    }
  }

  setHoverboard(boardId, preview = null) {
    if (this.player) {
      this.player.setHoverboard(boardId, preview);
    }
  }

  cycleHoverboard() {
    if (this.player) {
      return this.player.cycleHoverboard();
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.renderer.setAnimationLoop(this.animate.bind(this));
  }

  stop() {
    this.isRunning = false;
    this.renderer.setAnimationLoop(null);
  }

  animate() {
    const rawDelta = Math.min(this.clock.getDelta(), 0.1);
    const time = this.clock.getElapsedTime();

    // Hitstop (Milestone 9): clamp the SIMULATION delta to 0 for a brief
    // window after a real blocker hit, freezing player/world/collision on
    // that exact frame for a punchy impact beat. The camera keeps using
    // rawDelta below (not this clamped delta) so its shake decay and
    // spring-follow math keep animating smoothly straight through the
    // freeze -- it's specifically the gameplay simulation that stops, not
    // every visual, which is what actually reads as "impact" rather than
    // "the game glitched."
    const delta = performance.now() < this._hitStopUntil ? 0 : rawDelta;

    // Update game objects. Input is only ACTED on while PLAYING (during
    // LOBBY etc. InputManager still listens, but Player ignores it) --
    // physics/timers keep running regardless so an in-progress jump/slide
    // always resolves naturally rather than freezing mid-air on a mode switch.
    this.player.update(delta, this.mode === "PLAYING");

    // Only move the world if playing
    if (this.mode === "PLAYING") {
      this.world.update(delta);
      if (this.groundMat && this.groundMat.map && this.world.speed) {
        // Plane is 2000 units, repeating 200 times. 1 repeat = 10 world units.
        // The track moves towards the camera (-Z), so we scroll the texture
        // vertically by the exact same distance to lock it to the world.
        this.groundMat.map.offset.y += (this.world.speed * delta) / 10;
      }
    } else {
      // In LOBBY, we want pedestrians to keep walking/animating even though the world is stationary
      if (this.world && this.world.propSystem) {
        this.world.propSystem.update(0, delta, 50);
      }
    }

    // Always update nature systems regardless of game state
    this.dayNightCycle?.update(delta);
    this.weatherSystem?.update(delta);

    this.cameraRig.update(rawDelta, time, this.player.mesh.position, this.mode);

    if (this.quality.recordFrame(rawDelta)) {
      this._applyQualityTier();
    }

    if (this.mode === "PLAYING") {
      this.collisionSystem.update(delta, this.player, this.world, (hit) =>
        this._handleHit(hit),
      );
    }

    // Runs AFTER collisionSystem, not before: a coin hit THIS frame calls
    // effectsSystem.burst() synchronously from within collisionSystem's
    // onHit callback, and burst() only records the new particles' state --
    // it doesn't itself write any matrices. If this ran before
    // collisionSystem, a burst triggered this frame wouldn't get its first
    // real position/scale until NEXT frame's update(), rendering one frame
    // late (caught by this milestone's own verification script, not
    // assumed).
    this.effectsSystem.update(delta);

    this.composer.render();
  }

  dispose() {
    this.stop();
    this._unsubscribeViewport?.();
    this.inputManager?.dispose();
    this.renderer.dispose();
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
