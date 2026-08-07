import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { Player } from "../entities/Player.js";
import { WorldStreamer } from "../world/WorldStreamer.js";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { viewportManager } from "./ViewportManager.js";
import { CameraRig } from "./CameraRig.js";
import { QualityManager } from "./QualityManager.js";
import { InputManager } from "../systems/InputManager.js";
import { CollisionSystem } from "../systems/CollisionSystem.js";
import { ScoreSystem } from "../systems/ScoreSystem.js";

export class Engine {
  constructor(canvasContainer, onCollide) {
    this.container = canvasContainer;
    this.onCollide = onCollide || (() => {});

    // Scene setup - Real Atmosphere
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x8c7a6b, 0.0025); // Warm atmospheric fog

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
    this._unsubscribeViewport = viewportManager.subscribe((state) => this._onViewportChange(state));

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
  }

  // Called by App.vue's restartGame() -- resets everything the engine owns
  // that would otherwise silently carry over into a fresh run (score, and
  // the pre-existing but otherwise-unused player.lives counter).
  resetRun() {
    this.scoreSystem.reset();
    this.player.lives = 3;
  }

  // Wraps CollisionSystem's raw onHit payload: activates power-ups and
  // updates score BEFORE forwarding to Vue, so gameStats always receives an
  // already-enriched payload (score total, power-up outcome) rather than
  // Vue needing to know anything about ScoreSystem or Player internals.
  _handleHit(hit) {
    if (hit.type === "coin") {
      const result = this.scoreSystem.registerCoin(hit);
      if (hit.powerUp === "magnet") this.player.activateMagnet(hit.powerUpDurationMs);
      else if (hit.powerUp === "shield") this.player.activateShield();
      this.onCollide({ ...hit, score: result.total, points: result.points });
    } else {
      this.onCollide(hit);
    }
  }

  _onViewportChange(state) {
    this.cameraRig.updateFraming(state);
    const { width, height, pixelRatio } = this.quality.computeRendererSize(state);
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
    const texLoader = new THREE.TextureLoader();

    const setupModel = (model) => {
      if (!model) return null;
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(m => m.roughness = 0.8);
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
          texLoader.loadAsync(`${texFolder}/${prefix}_Roughness.webp`)
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
              metalness: 0.1
            });
          }
        });
        this.models[key] = model;
      } catch (err) {
        console.error(`Failed to load building ${key}:`, err);
      }
    };

    const setupStreetlight = (model) => {
      if (!model) return null;
      let singleArm = null;
      model.traverse((child) => {
        if (child.name === 'Single_arm') {
          singleArm = child;
        }
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          child.material = new THREE.MeshStandardMaterial({
            color: 0x222222,
            metalness: 0.8,
            roughness: 0.4
          });
        }
      });
      if (singleArm) {
        const group = new THREE.Group();
        singleArm.position.set(0, 3.46, 0);
        group.add(singleArm);
        return group;
      }
      return model;
    };

    await Promise.all([
      loadBuilding("build1", "/assets/models/buildings/L_build_1.glb", "/assets/textures/buildings", "L1"),
      loadBuilding("build2", "/assets/models/buildings/L_build_2.glb", "/assets/textures/buildings", "L2"),
      loadBuilding("build3", "/assets/models/buildings/L_build_3.glb", "/assets/textures/buildings", "L3"),
      loadModel("house1", "/assets/models/buildings/old_small_house.glb"),
      loadModel("railing", "/assets/models/environment/MetalRailing.glb"),
      loadModel("streetlight", "/assets/models/environment/StreetLightPoles.glb", setupStreetlight),
      loadModel("desert", "/assets/models/environment/Desert_field.glb", (m) => {
        m.traverse(child => {
          if (child.isMesh) {
            child.receiveShadow = true;
            if (child.material) {
              const oldMat = Array.isArray(child.material) ? child.material[0] : child.material;
              child.material = new THREE.MeshBasicMaterial({
                map: oldMat.map,
                color: oldMat.color
              });
            }
          }
        });
        return m;
      }),
      loadModel("maple", "/assets/models/trees/maple1.glb"),
      loadModel("poplar", "/assets/models/trees/poplar1.glb"),
      loadModel("whitePoplar", "/assets/models/trees/whitePoplar1.glb"),
    ]);

    if (this.models.desert) {
      const desert = this.models.desert;
      desert.scale.set(0.015, 0.015, 0.015);
      desert.position.set(0, -3.5, 0);
      this.scene.add(desert);
    }

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

    // We will apply the grass texture after it loads (handled via the texture loader reference)
    // 2. Endless Ground (Lush/Dark)
    const groundGeo = new THREE.PlaneGeometry(2000, 2000);
    this.groundMat = new THREE.MeshStandardMaterial({
      color: 0x4caf50, // Grass color base
      roughness: 0.8,
      metalness: 0.1,
    });

    // We update the ground material once we have the grass diffuse (in WorldGenerator or here).
    // Actually, we can just assign the texture directly here.
    const texLoader = new THREE.TextureLoader();
    const grassDiff = texLoader.load("/textures/grass_diffuse.jpg");
    grassDiff.wrapS = grassDiff.wrapT = THREE.RepeatWrapping;
    grassDiff.repeat.set(100, 100);
    grassDiff.colorSpace = THREE.SRGBColorSpace;

    const grassNorm = texLoader.load("/textures/grass_normal.jpg");
    grassNorm.wrapS = grassNorm.wrapT = THREE.RepeatWrapping;
    grassNorm.repeat.set(100, 100);

    this.groundMat.map = grassDiff;
    this.groundMat.normalMap = grassNorm;

    const ground = new THREE.Mesh(groundGeo, this.groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5; // Just below the track
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  setMode(newMode) {
    this.mode = newMode;
    if (this.mode === "LOBBY") {
      this.player.setAnimation("Idle");
      if (this.player.model) this.player.model.rotation.y = Math.PI; // Face the camera
    } else if (this.mode === "PLAYING") {
      this.player.setAnimation("Run");
      if (this.player.model) this.player.model.rotation.y = 0; // Face the track
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
    const delta = Math.min(this.clock.getDelta(), 0.1);
    const time = this.clock.getElapsedTime();

    // Update game objects. Input is only ACTED on while PLAYING (during
    // LOBBY etc. InputManager still listens, but Player ignores it) --
    // physics/timers keep running regardless so an in-progress jump/slide
    // always resolves naturally rather than freezing mid-air on a mode switch.
    this.player.update(delta, this.mode === "PLAYING");

    // Only move the world if playing
    if (this.mode === "PLAYING") {
      this.world.update(delta);
    }

    this.cameraRig.update(delta, time, this.player.mesh.position.x, this.mode);

    if (this.quality.recordFrame(delta)) {
      this._applyQualityTier();
    }

    if (this.mode === "PLAYING") {
      this.collisionSystem.update(delta, this.player, this.world, (hit) => this._handleHit(hit));
    }

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
