import * as THREE from "three";
import { levels } from "../../data/GameContent.js";
import { TrackBuilder } from "./TrackBuilder.js";
import { SceneryInstancer } from "./SceneryInstancer.js";
import { SpawnDirector } from "./SpawnDirector.js";
import { FootpathPropSystem } from "./FootpathPropSystem.js";
import { ObstacleFactory } from "../entities/Obstacles.js";
import {
  PLAYER_PHYSICS,
  REACTION_BASE_SPEED,
  POWER_UPS,
  FEATURE_SPACING_DISTANCE,
  TUTORIAL_SPEED_MULTIPLIER,
  TUTORIAL_DISTANCE,
  TUTORIAL_MECHANIC_BY_PATTERN,
  TUTORIAL_CHUNK_INDICES,
  JETPACK_FLIGHT_HEIGHT,
} from "../config/GameConfig.js";

// Replaces WorldGenerator. Same public API (constructor(scene, textures,
// models), setLevel(), update(delta), .trackPool, .speed) so Engine.js and
// App.vue need no changes beyond the import/instantiation site -- but the
// chunk-recycle mechanics underneath are completely different.
//
// The previous WorldGenerator deep-cloned ~80 GLB objects (30 railings, up
// to 50 trees, up to 2 buildings, up to 2 streetlights) every time a chunk
// recycled -- roughly every 0.67s at level-1 speed (trackLength=20 /
// speed=30), continuously throughout play. That work now happens once, at
// startup: SceneryInstancer pre-allocates one InstancedMesh pool per
// scenery variant, and each chunk's scenery slots are assigned a fixed
// (pool, instanceIndex) pair permanently. Recycling a chunk is now just a
// position update, an interactable-slot refresh, and a
// SceneryInstancer.rerollChunk() call that rewrites pre-existing matrix
// slots -- no allocation, no cloning, no new draw calls.
//
// Track surface (base/lanes/trim/borders) also moved into SceneryInstancer
// as global InstancedMesh pools. Coins and obstacles remain regular
// Object3D children of each chunk's Group (so CollisionSystem's existing
// child-traversal keeps working unmodified) but are pooled per-slot rather
// than per-chunk.
//
// Milestone 5: the old model was "at most one coin OR one blocker per
// chunk, 50/50, one random lane" -- the root cause of both the unwinnable
// level (near-zero coin density) and flat pacing (every chunk statistically
// identical). It's replaced by SpawnDirector-selected authored patterns,
// each combining multiple obstacles AND a coin trail in one ~20-unit
// segment. Every chunk now carries MAX_OBSTACLE_SLOTS obstacle slots and
// MAX_COIN_SLOTS coin slots (sized to the densest authored pattern), each
// obstacle slot pre-building all 4 OBSTACLE_TYPE_NAMES variants so any slot
// can show any type across different recycles without allocating. That's
// 15 chunks x 3 slots x 4 variants = 180 pre-created (mostly hidden,
// draw-call-free) obstacle Groups -- more objects than a dynamic allocator
// would need, but simpler to get right, and cheap since every variant's
// geometry/materials are shared via ObstacleFactory regardless of how many
// instances exist.
const OBSTACLE_TYPE_NAMES = [
  "BARRICADE_LOW",
  "BARRICADE_WIDE",
  "DRONE_LOW",
  "DRONE_HIGH",
];
const MAX_OBSTACLE_SLOTS = 3; // matches the densest authored pattern (gauntlet-three)
const MAX_COIN_SLOTS = 3; // matches the densest coin trail across all patterns
const HOVERBOARD_POST_JETPACK_DISTANCE = 70;

// Diverse aerial coin flight patterns for Jetpack (lanes: 0 = Left, 1 = Center, 2 = Right)
const SKY_COIN_PATTERNS = [
  [0, 1, 2, 1], // Wave Right: Left -> Center -> Right -> Center
  [2, 1, 0, 1], // Wave Left: Right -> Center -> Left -> Center
  [1, 0, 2, 1], // Center Diverge A: Center -> Left -> Right -> Center
  [1, 2, 0, 1], // Center Diverge B: Center -> Right -> Left -> Center
  [0, 2, 1, 0], // Zig-Zag A: Left -> Right -> Center -> Left
  [2, 0, 1, 2], // Zig-Zag B: Right -> Left -> Center -> Right
  [0, 1, 2, 0], // Full Sweep Right: Left -> Center -> Right -> Left
  [2, 1, 0, 2], // Full Sweep Left: Right -> Center -> Left -> Right
  [1, 0, 1, 2], // Slalom A: Center -> Left -> Center -> Right
  [1, 2, 1, 0], // Slalom B: Center -> Right -> Center -> Left
  [0, 2, 0, 2], // Hard Cross A: Left -> Right -> Left -> Right
  [2, 0, 2, 0], // Hard Cross B: Right -> Left -> Right -> Left
];

// Procedural radial starburst texture generator (Subway Surfers reward/pickup ray effect)
function createSunburstTexture(config) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const cx = 256;
  const cy = 256;
  const maxRadius = 245;
  const numRays = config.numRays || 18;

  ctx.clearRect(0, 0, 512, 512);
  ctx.save();
  ctx.translate(cx, cy);

  // Radiating sunburst ray wedges
  for (let i = 0; i < numRays; i++) {
    const angle = (i * 2 * Math.PI) / numRays;
    const halfWidth = (Math.PI / numRays) * 0.48;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, maxRadius, angle - halfWidth, angle + halfWidth);
    ctx.closePath();

    const rayGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, maxRadius);
    rayGrad.addColorStop(0, "rgba(255, 255, 255, 0.98)");
    rayGrad.addColorStop(0.18, config.rayInnerColor);
    rayGrad.addColorStop(0.65, config.rayMidColor);
    rayGrad.addColorStop(1, config.rayOuterColor);

    ctx.fillStyle = rayGrad;
    ctx.fill();
  }

  // Central radiant glow core
  const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, maxRadius * 0.65);
  coreGrad.addColorStop(0, "rgba(255, 255, 255, 1.0)");
  coreGrad.addColorStop(0.2, config.rayInnerColor);
  coreGrad.addColorStop(0.55, config.rayMidColor);
  coreGrad.addColorStop(1, "rgba(0, 120, 255, 0.0)");

  ctx.beginPath();
  ctx.arc(0, 0, maxRadius * 0.65, 0, Math.PI * 2);
  ctx.fillStyle = coreGrad;
  ctx.fill();

  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// Tunable styling for the Hoverboard track pickup radiant sunburst glow
export const HOVERBOARD_GLOW_CONFIG = {
  size: 2, // Diameter of the radiant sunburst rays
  numRays: 8, // Number of radiant light beams (e.g. 14, 18, 22)
  spinSpeed: 0.05, // Speed of ray rotation
  pulseSpeed: 2.0, // Breathing pulse speed
  baseOpacity: 0.7, // Transparency (0.0 to 1.0)
  lightColor: 0x00e5ff, // Point light color
  rayInnerColor: "rgba(154, 247, 255, 0.9)", // Glowing cyan origin
  rayMidColor: "rgba(153, 224, 255, 0.4)", // Mid-ray cyan/blue
  rayOuterColor: "rgba(0, 140, 255, 0.0)", // Fade to 100% transparent edge
};

export class WorldStreamer {
  constructor(scene, textures, models, engine) {
    this.scene = scene;
    this.engine = engine;
    this.textures = textures;
    this.models = models;
    this.levelBaseSpeed = 30; // per-level BASE speed (before in-level ramp); set by setLevel()
    this.speed = 30; // actual current speed, recomputed every frame in update() via the ramp

    this.poolSize = 15;
    this.activeZ = 10;
    this.trackLength = 20;
    this.trackPool = [];

    this.trackBuilder = new TrackBuilder(
      this.trackLength,
      textures?.asphaltNormal,
    );
    this.sceneryInstancer = new SceneryInstancer(
      scene,
      this.poolSize,
      this.trackBuilder,
    );
    this.chunkManifests = []; // parallel to trackPool, filled in by buildScenery()

    this.propSystem = new FootpathPropSystem(
      this.scene,
      this.models,
      [],
      this.engine,
    );

    this.obstacleFactory = new ObstacleFactory();
    this.spawnDirector = new SpawnDirector();

    // The plan's "minimum reaction distance" guarantee -- nothing spawns
    // closer than lookAheadZ -- holds structurally in this architecture
    // because new pattern content only ever appears when a chunk recycles
    // to the back of the pool (see SpawnDirector.dynamicLookAheadZ's doc
    // comment). Check that claim against this pool's actual depth instead
    // of leaving it an unverified assumption; *2 is a generous margin over
    // the highest realistic ramped speed.
    const poolDepth = this.poolSize * this.trackLength;
    const worstCaseLookAhead = this.spawnDirector.dynamicLookAheadZ(
      REACTION_BASE_SPEED * 2,
    );
    if (poolDepth < worstCaseLookAhead) {
      console.warn(
        `WorldStreamer: chunk pool depth (${poolDepth}) is less than the worst-case reaction distance (${worstCaseLookAhead}) -- increase poolSize.`,
      );
    }

    this._initCoinMaterials();

    this.currentLevel = 1;
    this.featuresToSpawn = [];
    this.blockersToSpawn = [];
    this.coinSpacing = 50;
    // Paces NEW feature dealing across the level's real run length instead
    // of the bag draining in the first ~15s -- see FEATURE_SPACING_DISTANCE.
    this._distanceSinceLastFeature = 0;

    // Interactive tutorial (Milestone 9) -- see startTutorial(). Inactive
    // (tutorialActive false, tutorialMechanic null) until Engine.js opts in.
    this._tutorialDistanceRemaining = 0;
    this.tutorialActive = false;
    this.tutorialMechanic = null;
    this._levelStartSpeedBlend = 1.0;

    this.chunkCoins = []; // [chunkIndex][slotIndex]
    this.chunkObstacles = []; // [chunkIndex][slotIndex] -> { activeType, variants: { TYPE: instance } }
    this._jetpackSpawnedThisRun = false;
    this._jetpackCollected = false;
    this._jetpackFlightCompleted = false;
    this._jetpackMissed = false;
    this._distanceSinceJetpackCompleted = 0;
    this._lastSkyCoinPatternIndex = -1;
    this.boardGlowSprite = null;
    this.boardGlowMat = null;
    this._boardSpawnedThisRun = false;
    this._isPopulatingInitialTrack = false;
    this._initPool();
    this._initSkyCoins();
  }

  _initCoinMaterials() {
    this.adminMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      roughness: 0.1,
      metalness: 1.0,
      emissive: 0xffaa00,
      emissiveIntensity: 0.5,
    });
    this.businessMat = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      roughness: 0.1,
      metalness: 1.0,
      emissive: 0x0088ff,
      emissiveIntensity: 0.5,
    });

    this.coinRingGeo = new THREE.TorusGeometry(0.45, 0.15, 16, 32);
    this.coinPlateGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 32);
    this.coinInnerRingGeo = new THREE.TorusGeometry(0.25, 0.05, 16, 32);

    // Distinct look for a power-up feature's coin (Milestone 6) -- bright
    // white/magenta glow, pulsed in update(), so it visually reads as
    // different from a plain admin/business feature before it's even
    // collected.
    this.powerUpMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.05,
      metalness: 1.0,
      emissive: 0xff66ff,
      emissiveIntensity: 0.8,
    });
  }

  _createCoinPoolObject() {
    const group = new THREE.Group();
    const ring = new THREE.Mesh(this.coinRingGeo, this.adminMat);
    const plate = new THREE.Mesh(this.coinPlateGeo, this.adminMat);
    plate.rotation.x = Math.PI / 2;
    const innerRing = new THREE.Mesh(this.coinInnerRingGeo, this.adminMat);
    group.add(ring, plate, innerRing);
    group.scale.set(1.5, 1.5, 1.5);
    group.visible = false;
    group.userData = { isInteractable: true, type: "coin" };
    return { group, ring, plate, innerRing, bobOffset: 0, baseY: 1.2 };
  }

  _initPool() {
    for (let i = 0; i < this.poolSize; i++) {
      const chunk = new THREE.Group();

      const coinSlots = [];
      for (let c = 0; c < MAX_COIN_SLOTS; c++) {
        const coin = this._createCoinPoolObject();
        chunk.add(coin.group);
        coinSlots.push(coin);
      }
      this.chunkCoins.push(coinSlots);

      const obstacleSlots = [];
      for (let s = 0; s < MAX_OBSTACLE_SLOTS; s++) {
        const variants = {};
        for (const typeName of OBSTACLE_TYPE_NAMES) {
          const instance = this.obstacleFactory.createInstance(typeName);
          instance.group.visible = false;
          chunk.add(instance.group);
          variants[typeName] = instance;
        }
        obstacleSlots.push({ activeType: null, variants });
      }
      this.chunkObstacles.push(obstacleSlots);

      chunk.position.z = this.activeZ - i * this.trackLength;
      this.scene.add(chunk);
      this.trackPool.push(chunk);
    }
  }

  _initSkyCoins() {
    this.skyCoins = [];
    // 4 Aerial Coins: 2 Blue (+100) and 2 Gold (+150) in a zigzag lane sequence
    // requiring active lane switching in the air while flying.
    const configs = [
      {
        lane: 0,
        zOffset: -25,
        mat: this.businessMat,
        coinType: "blue",
        name: "Aerial Blue Coin",
        category: "Business",
      },
      {
        lane: 2,
        zOffset: -50,
        mat: this.adminMat,
        coinType: "gold",
        name: "Aerial Gold Coin",
        category: "Admin",
      },
      {
        lane: 1,
        zOffset: -75,
        mat: this.businessMat,
        coinType: "blue",
        name: "Aerial Blue Coin",
        category: "Business",
      },
      {
        lane: 0,
        zOffset: -100,
        mat: this.adminMat,
        coinType: "gold",
        name: "Aerial Gold Coin",
        category: "Admin",
      },
    ];

    for (const cfg of configs) {
      const coin = this._createCoinPoolObject();
      coin.ring.material = cfg.mat;
      coin.plate.material = cfg.mat;
      coin.innerRing.material = cfg.mat;
      coin.baseY = JETPACK_FLIGHT_HEIGHT;
      coin.cfg = cfg;
      this.scene.add(coin.group);
      this.skyCoins.push(coin);
    }
  }

  spawnJetpackSkyCoins() {
    if (!this.skyCoins) return;

    // Pick a randomized aerial flight pattern, avoiding repeating the exact same pattern back-to-back
    let patternIndex = Math.floor(Math.random() * SKY_COIN_PATTERNS.length);
    if (
      SKY_COIN_PATTERNS.length > 1 &&
      patternIndex === this._lastSkyCoinPatternIndex
    ) {
      patternIndex = (patternIndex + 1) % SKY_COIN_PATTERNS.length;
    }
    this._lastSkyCoinPatternIndex = patternIndex;
    const pattern = SKY_COIN_PATTERNS[patternIndex];

    this.skyCoins.forEach((coin, idx) => {
      const cfg = coin.cfg;
      const lane = pattern[idx % pattern.length];
      coin.group.position.set(
        PLAYER_PHYSICS.lanes[lane],
        JETPACK_FLIGHT_HEIGHT,
        cfg.zOffset,
      );
      coin.bobOffset = Math.random() * Math.PI * 2;
      coin.group.userData = {
        isInteractable: true,
        type: "coin",
        name: cfg.name,
        category: cfg.category,
        coinType: cfg.coinType,
        isSkyCoin: true,
        isExclusive: false,
        bobOffset: coin.bobOffset,
      };
      coin.group.visible = true;
    });
  }

  clearSkyCoins() {
    if (this.skyCoins) {
      for (const coin of this.skyCoins) {
        coin.group.visible = false;
      }
    }
    if (this.jetpackPickupModel?.parent) {
      this.jetpackPickupModel.parent.remove(this.jetpackPickupModel);
    }
    if (this.boardPickupModel?.parent) {
      this.boardPickupModel.parent.remove(this.boardPickupModel);
    }
  }

  onJetpackCollected() {
    this._jetpackCollected = true;
  }

  onJetpackCompleted() {
    this._jetpackFlightCompleted = true;
    this._distanceSinceJetpackCompleted = 0;
  }

  // Called by Engine.js once loadAssets() has resolved. Builds every
  // InstancedMesh scenery pool and assigns each chunk's fixed slots.
  buildScenery() {
    // Create the single jetpack pickup instance
    this.jetpackPickupModel = new THREE.Group();
    if (this.models.jetpack) {
      const jp = this.models.jetpack.clone();
      jp.scale.set(0.17, 0.17, 0.17); // ~10% larger than previous
      jp.rotation.y = Math.PI;

      // Add a bluish glowing PointLight for the pickup instance
      const jetpackLight = new THREE.PointLight(0x00aaff, 3, 5);

      jp.traverse((child) => {
        if (child.name === "Nucleo") {
          child.add(jetpackLight);
        }

        if (child.isMesh && child.material) {
          const materials = Array.isArray(child.material)
            ? child.material
            : [child.material];
          materials.forEach((mat) => {
            if (mat.name === "Material.003") {
              mat.emissive = new THREE.Color(0x00aaff);
              mat.emissiveIntensity = 2.0;
            }
          });
        }
      });

      this.jetpackPickupModel.add(jp);
    }

    // Create the single hoverboard pickup instance
    this.boardPickupModel = new THREE.Group();
    if (this.models.board) {
      const bp = this.models.board.clone();
      bp.scale.set(0.18, 0.18, 0.18);
      bp.position.y = 0.3;
      bp.rotation.y = Math.PI / 2;

      // Add a glowing cyan PointLight for the pickup instance
      const boardLight = new THREE.PointLight(
        HOVERBOARD_GLOW_CONFIG.lightColor,
        2.0,
        4,
      );
      bp.add(boardLight);

      // Create radiant sunburst glow sprite behind the hoverboard
      const sunburstTex = createSunburstTexture(HOVERBOARD_GLOW_CONFIG);
      if (sunburstTex) {
        this.boardGlowMat = new THREE.SpriteMaterial({
          map: sunburstTex,
          color: 0xffffff,
          transparent: true,
          opacity: HOVERBOARD_GLOW_CONFIG.baseOpacity,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          depthTest: true,
        });
        this.boardGlowSprite = new THREE.Sprite(this.boardGlowMat);
        this.boardGlowSprite.position.set(0, 0.3, 0);
        this.boardGlowSprite.scale.set(
          HOVERBOARD_GLOW_CONFIG.size,
          HOVERBOARD_GLOW_CONFIG.size,
          1.0,
        );
        this.boardGlowSprite.renderOrder = 0;
        this.boardPickupModel.add(this.boardGlowSprite);
      }

      this.boardPickupModel.add(bp);
    }

    this.sceneryInstancer.build(this.models, this.poolSize, this.trackLength);
    for (let i = 0; i < this.poolSize; i++) {
      const manifest = this.sceneryInstancer.registerChunkSlots(i);
      this.chunkManifests.push(manifest);
      // registerChunkSlots() only assigns each slot's FIXED pool/instance
      // index -- the actual per-instance placement (tree x/z within its
      // side's range, tree scale, building visibility/z) is inert
      // placeholder data (x=0, i.e. the exact center of the road) until
      // rerollChunk() rolls real values. Every chunk normally gets that
      // roll on its first natural recycle (see update() below), but the
      // INITIAL 15 chunks built here never recycle before the player sees
      // them -- without this call, every tree in view at game start renders
      // glued to the road's centerline until its chunk individually
      // recycles for the first time (visibly fixing itself lane-by-lane a
      // few seconds in, exactly the reported symptom). Passing the
      // manifest's own already-decided `hasScenery` (the deliberate
      // alternating-chunk density pattern from registerChunkSlots) as the
      // override keeps that initial density design unchanged -- this only
      // fixes position/visibility jitter, not the density roll.
      this.sceneryInstancer.rerollChunk(manifest, manifest.hasScenery);
      // Sync immediately so scenery appears this frame rather than waiting
      // for the next update() tick.
      this.sceneryInstancer.syncChunk(manifest, this.trackPool[i].position.z);
    }
    this.sceneryInstancer.syncBuildings(this.activeZ, 0); // Seed buildings for lobby
    this.sceneryInstancer.flush();
    if (this.propSystem) {
      this.propSystem.generateChunk(0, -800);
    }
  }

  // Calculates fair coin spacing based on level targetDurationSeconds (or speedMultiplier) and requiredCount.
  // Can be manually overridden per-level in GameContent.js via coinSpacing: <number>.
  _calculateCoinSpacing(levelData) {
    if (
      typeof levelData?.coinSpacing === "number" &&
      levelData.coinSpacing > 0
    ) {
      return levelData.coinSpacing;
    }

    const speedMult = levelData?.speedMultiplier ?? 1.0;
    const targetDuration =
      typeof levelData?.targetDurationSeconds === "number" &&
      levelData.targetDurationSeconds > 0
        ? levelData.targetDurationSeconds
        : speedMult * 60;

    const baseSpeed = 30 * speedMult;
    const totalDistance = baseSpeed * targetDuration;
    const requiredCoins = Math.max(1, levelData?.requiredCount ?? 10);

    // Leave ~12% headroom for level start safe runway, tutorial/slowdown, and obstacle avoidance
    const effectiveTrackDistance = totalDistance * 0.88;
    const spacing = Math.round(effectiveTrackDistance / requiredCoins);

    // Bounded between safe minimum (30) and maximum (450) world units
    return Math.max(30, Math.min(450, spacing));
  }

  setLevel(level) {
    this.currentLevel = level;
    const levelData = levels.find((l) => l.id === level);
    if (levelData) {
      this.currentLevelData = levelData;
      this.levelBaseSpeed = 30 * levelData.speedMultiplier;
      // Start slow (using the same multiplier as the tutorial) to allow a smooth 5-second ramp-up
      this.speed = this.levelBaseSpeed * TUTORIAL_SPEED_MULTIPLIER;
      this._levelStartSpeedBlend = 0.0;
      this.spawnDirector.resetForLevel(levelData);
      // Milestone 6 fix for the unwinnable level: deal the level's features
      // as a shuffled bag WITHOUT replacement (not 3 copies pre-shuffled
      // together, which let the SAME name be drawn again before every
      // OTHER name had even appeared once -- the coupon-collector problem
      // that made a 22-feature level need ~81 collects). _nextFeature()
      // reshuffles and refills this bag automatically once emptied, so a
      // missed coin is never a permanent loss.
      this.levelFeatures = levelData.features;
      this.featuresToSpawn = this._shuffledFeatureBag();
      this.blockersToSpawn = levelData.blockers;
      this._jetpackSpawnedThisRun = false;
      this._jetpackCollected = false;
      this._jetpackFlightCompleted = false;
      this._jetpackMissed = false;
      this._distanceSinceJetpackCompleted = 0;
      this._boardSpawnedThisRun = false;
      this._isPopulatingInitialTrack = false;
      this.coinSpacing = this._calculateCoinSpacing(levelData);
      // Start "already spaced" so the very first coin trail encountered
      // can deal a feature immediately, rather than making the player run
      // with nothing to collect.
      this._distanceSinceLastFeature = this.coinSpacing;

      // Clear all existing obstacles and coins from the track to provide a safe
      // "breather" runway (a few seconds of empty track) at the start of the level.
      for (let i = 0; i < this.poolSize; i++) {
        // Clear coins
        for (const coin of this.chunkCoins[i]) {
          coin.group.visible = false;
        }
        // Clear obstacles
        for (const slot of this.chunkObstacles[i]) {
          if (slot.activeType) {
            slot.variants[slot.activeType].group.visible = false;
          }
          slot.activeType = null;
        }
      }
      this.clearSkyCoins();
    }
  }

  // Pre-populates the existing track chunks immediately, so the player
  // doesn't have to run 300 units on an empty track before the first
  // chunks recycle. Skips chunks that were already populated (e.g. by startTutorial).
  populateInitialTrack() {
    this._isPopulatingInitialTrack = true;
    for (let i = 0; i < this.poolSize; i++) {
      // If tutorial is active, leave non-tutorial chunks empty to avoid distracting the player
      if (this.tutorialActive && !TUTORIAL_CHUNK_INDICES.includes(i)) {
        continue;
      }

      // If this chunk already has content (like a seeded tutorial chunk), skip it
      let hasContent = false;
      for (const slot of this.chunkObstacles[i]) {
        if (slot.activeType) hasContent = true;
      }
      if (hasContent) continue;

      const chunk = this.trackPool[i];
      const chunkZ = chunk ? chunk.position.z : 0;

      // Safe Runway Zone:
      // When starting a new level (or restarting), provide a clear safe runway in front of the player
      // (approx 60 world units ahead, and anything behind/at player spawn).
      // Populate these runway chunks with a peaceful coin trail and ZERO obstacles
      // so the player has ~2-3 seconds to prepare, get oriented, and collect opening coins safely.
      if (!this.tutorialActive && chunkZ > -60) {
        if (chunkZ <= 20) {
          // Spawn coin trail for chunks in front of camera, leave chunks behind empty
          this._refreshChunkContent(i, true, "empty-coin-trail");
        }
        continue;
      }

      const baseDensity = this.currentLevelData?.obstacleDensity ?? 0.4;
      const sceneryChance = Math.min(
        0.9,
        baseDensity * this.spawnDirector.getDensityFactor(),
      );
      this._refreshChunkContent(i, Math.random() < sceneryChance);
    }
    this._isPopulatingInitialTrack = false;
  }

  // Milestone 9 interactive tutorial. Seeds 3 chunks DIRECTLY (bypassing
  // the normal wait-for-natural-recycle path) with one scripted pattern
  // per mechanic -- see GameConfig.js's long comment on why: every pooled
  // chunk starts empty until its OWN first recycle, and for anything but
  // the nearest few chunks that's hundreds of units away, far more than a
  // "~15 second" opening tutorial can wait for. Also engages the slowdown
  // (see update()) for TUTORIAL_DISTANCE units of travel from right now.
  startTutorial(patternIds, chunkIndices) {
    this.tutorialActive = true;
    this._tutorialDistanceRemaining = TUTORIAL_DISTANCE;
    this.tutorialMechanic = TUTORIAL_MECHANIC_BY_PATTERN[patternIds[0]] || null;
    patternIds.forEach((id, idx) => {
      const chunkIndex = chunkIndices[idx];
      if (chunkIndex === undefined) return;
      this._refreshChunkContent(chunkIndex, true, id);
    });
  }

  _shuffledFeatureBag() {
    const bag = [...this.levelFeatures];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    return bag;
  }

  // Refills and reshuffles automatically once the current bag is
  // exhausted -- see setLevel()'s comment. Returns undefined only if
  // setLevel() was never called (defensive; App.vue always calls it
  // before entering PLAYING mode).
  _nextFeature() {
    if (!this.levelFeatures || this.levelFeatures.length === 0)
      return undefined;
    if (this.featuresToSpawn.length === 0) {
      this.featuresToSpawn = this._shuffledFeatureBag();
    }
    return this.featuresToSpawn.pop();
  }

  // Picks a SpawnDirector pattern (gated by the current difficulty ramp and
  // speed) and activates the obstacle/coin slots it calls for; deactivates
  // everything first so a chunk that recycles from "full gauntlet" to
  // "empty breather" doesn't leave stale obstacles visible. Gated on
  // `hasScenery` so interactable density follows the same ramped pacing as
  // scenery (see update()).
  // `forcedId` (Milestone 9): dealt straight to SpawnDirector.selectPattern(),
  // which resolves that SPECIFIC pattern instead of a random one -- see its
  // own comment. Also marks every obstacle this pattern places as
  // isTutorial, which App.vue's blocker-hit handling reads to skip the
  // life cost for a miss during the tutorial's first-ever-controls window.
  _refreshChunkContent(i, hasScenery, forcedId = null) {
    const coinSlots = this.chunkCoins[i];
    const obstacleSlots = this.chunkObstacles[i];

    for (const coin of coinSlots) coin.group.visible = false;
    for (const slot of obstacleSlots) {
      if (slot.activeType) slot.variants[slot.activeType].group.visible = false;
      slot.activeType = null;
    }

    if (!hasScenery) return;

    const pattern = this.spawnDirector.selectPattern(
      this.spawnDirector.getMaxDifficulty(),
      this.speed,
      forcedId,
    );

    pattern.obstacles.forEach((obs, idx) => {
      if (idx >= obstacleSlots.length) return; // safety net; no authored pattern exceeds MAX_OBSTACLE_SLOTS
      const slot = obstacleSlots[idx];
      const instance = slot.variants[obs.type];
      slot.activeType = obs.type;

      const x =
        obs.lanes.length === 2
          ? (PLAYER_PHYSICS.lanes[obs.lanes[0]] +
              PLAYER_PHYSICS.lanes[obs.lanes[1]]) /
            2
          : PLAYER_PHYSICS.lanes[obs.lanes[0]];
      instance.group.position.set(x, 0, obs.z);

      // Pain-point NAMING is independent of the visual/physical obstacle
      // type -- GameContent.js's blockers are pain-point concepts, not tied
      // to a specific shape -- so any of the 4 types can carry any pain
      // point, picked with replacement exactly as the old single-blocker
      // model did (blockers are meant to recur often, unlike coins).
      const painPoint =
        this.blockersToSpawn.length > 0
          ? this.blockersToSpawn[
              Math.floor(Math.random() * this.blockersToSpawn.length)
            ]
          : null;
      instance.group.userData = {
        isInteractable: true,
        type: "blocker",
        name: painPoint ? painPoint.id : obs.type,
        text: painPoint ? painPoint.text : "",
        consequence: painPoint ? painPoint.consequence : "",
        // Real obstacle shape (e.g. "BARRICADE_LOW") and lane span --
        // `name`/`text` above are the PAIN-POINT identity, independent of
        // shape (any of the 4 types can carry any pain point), so the
        // actual OBSTACLE_TYPES key would otherwise be lost once a pain
        // point is assigned. Milestone 9's near-miss detection
        // (CollisionSystem) needs both: which lane(s) this occupies, and
        // whether its escape is jump/slide (a genuine close call) or
        // switch (just normal lateral avoidance, not a "near" miss).
        obstacleType: obs.type,
        lanes: obs.lanes,
        isTutorial: !!forcedId,
      };
      instance.group.visible = true;
    });

    pattern.coins.forEach((coinDef, idx) => {
      if (idx >= coinSlots.length) return;

      let featureData = null;
      if (
        !this._jetpackSpawnedThisRun &&
        this.featuresToSpawn.length <=
          Math.max(0, this.levelFeatures.length - 2)
      ) {
        // Spawn Jetpack first (roughly after 2 regular features have been dealt)
        this._jetpackSpawnedThisRun = true;
        featureData = { name: "Jetpack", category: "PowerUp" };
        this._distanceSinceLastFeature = 0;
      } else if (
        !this._boardSpawnedThisRun &&
        this._jetpackSpawnedThisRun &&
        !this._isPopulatingInitialTrack &&
        !this.engine?.player?.hasJetpack &&
        ((this._jetpackFlightCompleted &&
          this._distanceSinceJetpackCompleted >=
            HOVERBOARD_POST_JETPACK_DISTANCE) ||
          (this._jetpackMissed &&
            this._distanceSinceJetpackCompleted >=
              HOVERBOARD_POST_JETPACK_DISTANCE))
      ) {
        // Spawn Hoverboard strictly after Jetpack flight is completed + distance delay (or fallback if missed)
        this._boardSpawnedThisRun = true;
        featureData = { name: "Hoverboard", category: "PowerUp" };
        this._distanceSinceLastFeature = 0;
      } else {
        const spacingReq =
          this.coinSpacing ?? (this.currentLevel === 3 ? 45 : 35);
        if (this._distanceSinceLastFeature < spacingReq) return;
        featureData = this._nextFeature();
        if (!featureData) return; // setLevel() never called yet
        this._distanceSinceLastFeature = 0;
      }

      const coin = coinSlots[idx];
      // Cleanup any previously attached jetpack or board model if this slot was reused
      if (
        this.jetpackPickupModel &&
        this.jetpackPickupModel.parent === coin.group
      ) {
        coin.group.remove(this.jetpackPickupModel);
      }
      if (
        this.boardPickupModel &&
        this.boardPickupModel.parent === coin.group
      ) {
        coin.group.remove(this.boardPickupModel);
      }

      const powerUpDef = POWER_UPS[featureData.name];
      const isAdmin = featureData.category.includes("Admin");
      const mat = powerUpDef
        ? this.powerUpMat
        : isAdmin
          ? this.adminMat
          : this.businessMat;

      if (featureData.name === "Jetpack") {
        // Render physical jetpack model, hide the coin meshes
        coin.ring.visible = false;
        coin.plate.visible = false;
        coin.innerRing.visible = false;
        if (this.jetpackPickupModel) {
          coin.group.add(this.jetpackPickupModel);
        }
      } else if (featureData.name === "Hoverboard") {
        // Render physical hoverboard model, hide the coin meshes
        coin.ring.visible = false;
        coin.plate.visible = false;
        coin.innerRing.visible = false;
        if (this.boardPickupModel) {
          coin.group.add(this.boardPickupModel);
        }
      } else {
        // Standard feature/powerup coin
        coin.ring.visible = true;
        coin.plate.visible = true;
        coin.innerRing.visible = true;
        coin.ring.material = mat;
        coin.plate.material = mat;
        coin.innerRing.material = mat;
      }

      coin.baseY =
        featureData.name === "Hoverboard" || featureData.name === "Jetpack"
          ? 1.2
          : (coinDef.y ?? 1.2);
      coin.group.position.set(
        PLAYER_PHYSICS.lanes[coinDef.lane],
        coin.baseY,
        coinDef.z,
      );
      coin.bobOffset = Math.random() * Math.PI * 2;
      coin.group.userData = {
        isInteractable: true,
        type: "coin",
        name: featureData.name,
        category: featureData.category,
        coinType: powerUpDef ? "pink" : isAdmin ? "gold" : "blue",
        isExclusive: featureData.isExclusive || false,
        exclusiveLine: featureData.exclusiveLine || null,
        bobOffset: coin.bobOffset,
        powerUp: powerUpDef ? powerUpDef.type : null,
        powerUpDurationMs: powerUpDef?.durationMs,
      };
      coin.group.visible = true;
    });
  }

  update(delta) {
    // Ramp speed by DISTANCE traveled (see SpawnDirector), then advance the
    // ramp tracker by however far that ramped speed just moved the world
    // this frame -- speed and the distance that drives it stay consistent
    // within the same frame rather than one frame lagging the other.
    // While the tutorial is active, a flat slowdown REPLACES the ramped
    // speed entirely (see GameConfig.js's TUTORIAL_SPEED_MULTIPLIER
    // comment for why this is a slowdown, not a hard freeze).
    // After the tutorial, smoothly blend to the target speed over ~1.6s
    let targetSpeed;
    if (this.tutorialActive) {
      targetSpeed = this.levelBaseSpeed * TUTORIAL_SPEED_MULTIPLIER;
      this._levelStartSpeedBlend = 0.0;
    } else {
      targetSpeed = this.spawnDirector.getRampedSpeed(this.levelBaseSpeed);
    }

    if (!this.tutorialActive && this._levelStartSpeedBlend < 1.0) {
      this._levelStartSpeedBlend = Math.min(
        1.0,
        this._levelStartSpeedBlend + delta * 0.2,
      );
      const startSpeed = this.levelBaseSpeed * TUTORIAL_SPEED_MULTIPLIER;
      const t = this._levelStartSpeedBlend;
      const ease = t * t * (3 - 2 * t); // smoothstep
      this.speed = startSpeed + (targetSpeed - startSpeed) * ease;
    } else {
      this.speed = targetSpeed;
    }
    const moveDist = this.speed * delta;
    this.spawnDirector.advance(moveDist);
    this._distanceSinceLastFeature += moveDist;
    if (
      (this._jetpackFlightCompleted || this._jetpackMissed) &&
      !this._boardSpawnedThisRun
    ) {
      this._distanceSinceJetpackCompleted += moveDist;
    }

    if (this.propSystem) {
      this.propSystem.update(this.speed, delta, 50);

      if (!this.distanceTraveledProps) this.distanceTraveledProps = 0;
      this.distanceTraveledProps += moveDist;

      // Generate a new 200 unit chunk every time we travel 200 units
      if (this.distanceTraveledProps > 200) {
        // Shift the bench spawn cursor by +200 because the old window is gone,
        // and we are about to evaluate the exact same absolute bounds again!
        this.propSystem.nextBenchZ[1] += 200;
        this.propSystem.nextBenchZ["-1"] += 200;
        this.propSystem.generateChunk(-800, -1000);
        this.distanceTraveledProps -= 200;
      }
    }

    if (this.tutorialActive) {
      this._tutorialDistanceRemaining -= moveDist;
      if (this._tutorialDistanceRemaining <= 0) {
        this.tutorialActive = false;
        this.tutorialMechanic = null;
      }
    }

    const sceneryReady = this.sceneryInstancer.ready;
    const time = Date.now() * 0.005;

    for (let i = 0; i < this.trackPool.length; i++) {
      const chunk = this.trackPool[i];
      chunk.position.z += moveDist;

      for (const coin of this.chunkCoins[i]) {
        if (coin.group.visible) {
          coin.group.rotation.y += 3 * delta;
          coin.group.position.y =
            coin.baseY + Math.sin(time + coin.bobOffset) * 0.2;
          if (coin.group.userData.powerUp) {
            // Shared material across every power-up coin (at most 1-2 are
            // ever visible at once, given only 2 power-up features exist
            // total) -- a synchronized pulse is a fine, simple tell.
            const pulse = 0.6 + Math.sin(time * 6) * 0.4;
            this.powerUpMat.emissiveIntensity = pulse;
          }
        }
      }

      if (this.boardGlowSprite && this.boardGlowMat) {
        // Smoothly rotate the radiant sunburst rays
        this.boardGlowMat.rotation += HOVERBOARD_GLOW_CONFIG.spinSpeed * delta;

        // Subtle breathing pulse
        const pulse =
          0.5 + 0.5 * Math.sin(time * HOVERBOARD_GLOW_CONFIG.pulseSpeed);
        const currentSize = HOVERBOARD_GLOW_CONFIG.size * (0.92 + 0.16 * pulse);
        this.boardGlowSprite.scale.set(currentSize, currentSize, 1.0);
        this.boardGlowMat.opacity =
          HOVERBOARD_GLOW_CONFIG.baseOpacity * (0.85 + 0.15 * pulse);
      }
      for (const slot of this.chunkObstacles[i]) {
        if (slot.activeType) slot.variants[slot.activeType].update(time);
      }
    }

    if (this.skyCoins) {
      for (const coin of this.skyCoins) {
        if (coin.group.visible) {
          coin.group.position.z += moveDist;
          coin.group.rotation.y += 3 * delta;
          coin.group.position.y =
            JETPACK_FLIGHT_HEIGHT + Math.sin(time + coin.bobOffset) * 0.2;
          if (coin.group.position.z > 20) {
            coin.group.visible = false;
          }
        }
      }
    }

    for (let i = 0; i < this.trackPool.length; i++) {
      const chunk = this.trackPool[i];
      if (chunk.position.z > this.activeZ + this.trackLength) {
        if (
          !this._jetpackCollected &&
          this._jetpackSpawnedThisRun &&
          !this._jetpackMissed
        ) {
          for (const coin of this.chunkCoins[i]) {
            if (
              coin.group.userData &&
              coin.group.userData.name === "Jetpack" &&
              coin.group.visible
            ) {
              this._jetpackMissed = true;
              this._distanceSinceJetpackCompleted = 0;
            }
          }
        }

        // Use mathematical wrapping to maintain perfect spacing
        // and avoid loop-dependency drift which causes visual gaps.
        chunk.position.z -= this.poolSize * this.trackLength;

        if (this.tutorialActive) {
          // Any OTHER chunk reaching its natural recycle threshold during
          // the tutorial window must never get a normal random pattern --
          // a stray obstacle appearing while the player is still learning
          // the 3 seeded ones would be confusing and unfair. Scenery still
          // rerolls normally (background dressing, not gameplay content).
          if (sceneryReady)
            this.sceneryInstancer.rerollChunk(this.chunkManifests[i], true);
          this._refreshChunkContent(i, true, "empty-coin-trail");
        } else {
          // Scenery (background dressing)
          const sceneryChance = 0.8;
          let hasScenery = Math.random() < sceneryChance;
          if (sceneryReady) {
            this.sceneryInstancer.rerollChunk(
              this.chunkManifests[i],
              hasScenery,
            );
          }

          // Gameplay Density (obstacles and coins)
          const baseDensity = this.currentLevelData?.obstacleDensity ?? 0.5;
          const gameplayChance = Math.min(
            0.9,
            baseDensity * this.spawnDirector.getDensityFactor(),
          );

          let hasGameplay = Math.random() < gameplayChance;

          // Enforce consistent spacing (Subway Surfers style)
          // Prevent too many empty chunks in a row, or too many full chunks in a row
          if (hasGameplay) {
            this.consecutiveEmptyChunks = 0;
            this.consecutiveFullChunks = (this.consecutiveFullChunks || 0) + 1;
            if (this.consecutiveFullChunks > 3) {
              // Max 3 obstacle chunks in a row
              hasGameplay = false;
              this.consecutiveFullChunks = 0;
            }
          } else {
            this.consecutiveFullChunks = 0;
            this.consecutiveEmptyChunks =
              (this.consecutiveEmptyChunks || 0) + 1;
            if (this.consecutiveEmptyChunks > 1) {
              // Max 1 empty chunk in a row
              hasGameplay = true;
              this.consecutiveEmptyChunks = 0;
            }
          }

          if (hasGameplay) {
            this._refreshChunkContent(i, true);
          } else {
            // Provide a breather chunk with just a coin trail, no obstacles
            this._refreshChunkContent(i, true, "empty-coin-trail");
          }
        }
      }

      if (sceneryReady) {
        this.sceneryInstancer.syncChunk(
          this.chunkManifests[i],
          chunk.position.z,
        );
      }
    }

    if (sceneryReady) {
      // Sync independent buildings
      this.sceneryInstancer.syncBuildings(this.activeZ, moveDist);
      this.sceneryInstancer.flush();
    }
  }
}
