import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { Player } from "../entities/Player.js";
import { WorldStreamer } from "../world/WorldStreamer.js";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { viewportManager } from "./ViewportManager.js";
import { CameraRig } from "./CameraRig.js";
import { QualityManager } from "./QualityManager.js";
import { InputManager } from "../systems/InputManager.js";
import { CollisionSystem } from "../systems/CollisionSystem.js";
import { ScoreSystem } from "../systems/ScoreSystem.js";
import { EffectsSystem } from "../systems/EffectsSystem.js";
import { characterLoader } from "../entities/CharacterLoader.js";
import { audioManager } from "../systems/AudioManager.js";
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
} from "../config/GameConfig.js";

export class Engine {
  constructor(canvasContainer, onCollide) {
    this.container = canvasContainer;
    this.onCollide = onCollide || (() => {});

    // Scene setup - Real Atmosphere
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0xd4c9b0, 0.0018); // Warm daylight haze, low density

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
      ? new UnrealBloomPass(new THREE.Vector2(1, 1), 0.4, 0.4, 1.0)
      : null;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(renderScene);
    if (this.bloomPass) this.composer.addPass(this.bloomPass);

    // Clock for delta time
    this.clock = new THREE.Clock();

    // Lights
    const ambientLight = new THREE.AmbientLight(0xfff0dd, 0.5); // Warm ambient
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfffaeb, 2.5); // Warm sunlight directional
    dirLight.position.set(20, 30, 10);
    dirLight.castShadow = this.quality.tier.shadows;

    // Tightly constrain the shadow camera to 40 units around the origin so distant trees don't render into the shadow map
    dirLight.shadow.camera.left = -40;
    dirLight.shadow.camera.right = 40;
    dirLight.shadow.camera.top = 40;
    dirLight.shadow.camera.bottom = -40;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 100;
    dirLight.shadow.bias = -0.0005; // Prevent shadow acne

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

    // Input: keyboard + touch, bound to the canvas container (not window) so
    // UI button taps -- captured by the UI layer sitting in front -- never
    // reach these listeners as spurious swipes.
    this.inputManager = new InputManager(this.container);

    // Game Entities
    this.player = new Player(this.scene, this.inputManager);

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
    this.world = new WorldStreamer(this.scene, textures, this.models);

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
    this._tutorialShownThisRun = false;
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
      audioManager.playSFX(hit.powerUp ? "powerup" : "coin");
      if (hit.worldPosition) {
        this.effectsSystem.burst(
          hit.worldPosition,
          hit.powerUp === "shield" ? 0x00e5ff : 0xffd700,
        );
      }
      // worldPosition is a shared mutable scratch vector (see
      // CollisionSystem's comment) -- must NOT reach Vue's reactive
      // gameStats, which is why it's excluded here rather than spread
      // through along with everything else.
      const { worldPosition, ...vueHit } = hit;
      this.onCollide({ ...vueHit, score: result.total, points: result.points });
    } else if (hit.type === "shielded") {
      audioManager.playSFX("shield");
      this.onCollide(hit);
    } else if (hit.type === "blocker") {
      audioManager.playSFX("hit");
      // Hitstop + camera shake + haptics -- the "impact" side of hit juice.
      // The stumble animation and red flash are Player.js's own job
      // (already existed / see takeHit()), triggered independently by
      // CollisionSystem calling player.takeHit() before this ever runs.
      this._hitStopUntil = performance.now() + HIT_STOP_MS;
      this.cameraRig.triggerShake(HIT_SHAKE_MAGNITUDE, HIT_SHAKE_DURATION);
      if (navigator.vibrate) navigator.vibrate(HIT_VIBRATE_MS);
      this.onCollide(hit);
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
        }
      } catch (err) {
        console.error(`Failed to load ${url}:`, err);
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
      loadModel("railing", "/assets/models/environment/MetalRailing.glb"),
      loadModel(
        "desert",
        "/assets/models/environment/Desert_field.glb",
        (m) => {
          m.traverse((child) => {
            if (child.isMesh) {
              child.receiveShadow = true;
              if (child.material) {
                const oldMat = Array.isArray(child.material)
                  ? child.material[0]
                  : child.material;
                child.material = new THREE.MeshBasicMaterial({
                  map: oldMat.map,
                  color: oldMat.color,
                });
              }
            }
          });
          return m;
        },
      ),
      loadModel("airport_plant", "/assets/models/trees/airport_plant.glb"),

      // Footpath props
      loadModel("atm", "/assets/models/environment/props/atm.glb"),
      loadModel("bench", "/assets/models/environment/props/bench.glb"),
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
    ]);

    // Desert model removed - it rendered as a white/snowy landscape that washed out the track visuals.
    // The ground plane in initAtmosphere() provides the base green ground like the reference game.

    // Now that assets are loaded, build every scenery InstancedMesh pool and
    // assign each chunk's fixed slots -- the world has no scenery at all
    // until this runs (see WorldStreamer/SceneryInstancer), so this is the
    // one moment it all appears at once instead of swapping in per-chunk.
    if (this.world) {
      this.world.buildScenery();
    }
  }

  initAtmosphere() {
    // Procedural Sky Simulation (replaces basic HDR background)
    const sky = new Sky();
    sky.scale.setScalar(10000);
    this.scene.add(sky);

    const skyUniforms = sky.material.uniforms;
    skyUniforms["turbidity"].value = 10;
    skyUniforms["rayleigh"].value = 0.5; // Lower for less blown-out sky
    skyUniforms["mieCoefficient"].value = 0.005;
    skyUniforms["mieDirectionalG"].value = 0.7;

    // Calculate Sun Position for a deep cinematic sunset look
    const sun = new THREE.Vector3();
    const phi = THREE.MathUtils.degToRad(89.5); // Very close to horizon for orange/red

    // Set theta to 0 so the sun is BEHIND the player, lighting up the track without blinding the camera
    const theta = THREE.MathUtils.degToRad(0);

    sun.setFromSphericalCoords(1, phi, theta);
    sky.material.uniforms["sunPosition"].value.copy(sun);

    // Load HDRI for reflections only (not background)
    new RGBELoader()
      .setPath("/textures/")
      .load("venice_sunset_1k.hdr", (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        // Keep environment for realistic reflections on coins/character
        this.scene.environment = texture;
      });

    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    // 2. Endless Ground - clean green base matching the reference game
    const groundGeo = new THREE.PlaneGeometry(2000, 2000);
    this.groundMat = new THREE.MeshStandardMaterial({
      color: 0x228b22, // Forest green - matches reference game exactly
      roughness: 0.9,
      metalness: 0.0,
    });

    const ground = new THREE.Mesh(groundGeo, this.groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.15; // Just below the track
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  setMode(newMode) {
    this.mode = newMode;
    if (this.mode === "LOBBY") {
      this.player.setAnimation("Idle");
      this.player.setFacing(Math.PI); // Face the camera
    } else if (this.mode === "PLAYING") {
      this.player.setAnimation("Run");
      this.player.setFacing(0); // Face the track
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
    }

    this.cameraRig.update(
      rawDelta,
      time,
      this.player.mesh.position.x,
      this.mode,
    );

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
