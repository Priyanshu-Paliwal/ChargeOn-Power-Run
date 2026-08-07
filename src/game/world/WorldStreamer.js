import * as THREE from "three";
import { levels } from "../../data/GameContent.js";
import { TrackBuilder } from "./TrackBuilder.js";
import { SceneryInstancer } from "./SceneryInstancer.js";
import { SpawnDirector } from "./SpawnDirector.js";
import { ObstacleFactory } from "../entities/Obstacles.js";
import { PLAYER_PHYSICS, REACTION_BASE_SPEED, POWER_UPS, FEATURE_SPACING_DISTANCE } from "../config/GameConfig.js";

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
const OBSTACLE_TYPE_NAMES = ["BARRICADE_LOW", "BARRICADE_WIDE", "DRONE_LOW", "DRONE_HIGH"];
const MAX_OBSTACLE_SLOTS = 3; // matches the densest authored pattern (gauntlet-three)
const MAX_COIN_SLOTS = 3; // matches the densest coin trail across all patterns

export class WorldStreamer {
  constructor(scene, textures, models) {
    this.scene = scene;
    this.textures = textures;
    this.models = models;
    this.levelBaseSpeed = 30; // per-level BASE speed (before in-level ramp); set by setLevel()
    this.speed = 30; // actual current speed, recomputed every frame in update() via the ramp

    this.poolSize = 15;
    this.activeZ = 10;
    this.trackLength = 20;
    this.trackPool = [];

    this.trackBuilder = new TrackBuilder(this.trackLength, textures?.asphaltNormal);
    this.sceneryInstancer = new SceneryInstancer(scene, this.poolSize, this.trackBuilder);
    this.chunkManifests = []; // parallel to trackPool, filled in by buildScenery()

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
    const worstCaseLookAhead = this.spawnDirector.dynamicLookAheadZ(REACTION_BASE_SPEED * 2);
    if (poolDepth < worstCaseLookAhead) {
      console.warn(
        `WorldStreamer: chunk pool depth (${poolDepth}) is less than the worst-case reaction distance (${worstCaseLookAhead}) -- increase poolSize.`,
      );
    }

    this._initCoinMaterials();

    this.currentLevel = 1;
    this.featuresToSpawn = [];
    this.blockersToSpawn = [];
    // Paces NEW feature dealing across the level's real run length instead
    // of the bag draining in the first ~15s -- see FEATURE_SPACING_DISTANCE.
    this._distanceSinceLastFeature = 0;

    this.chunkCoins = []; // [chunkIndex][slotIndex]
    this.chunkObstacles = []; // [chunkIndex][slotIndex] -> { activeType, variants: { TYPE: instance } }
    this._initPool();
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

  // Called by Engine.js once loadAssets() has resolved. Builds every
  // InstancedMesh scenery pool and assigns each chunk's fixed slots.
  buildScenery() {
    this.sceneryInstancer.build(this.models);
    for (let i = 0; i < this.poolSize; i++) {
      const manifest = this.sceneryInstancer.registerChunkSlots(i);
      this.chunkManifests.push(manifest);
      // Sync immediately so scenery appears this frame rather than waiting
      // for the next update() tick.
      this.sceneryInstancer.syncChunk(manifest, this.trackPool[i].position.z);
    }
    this.sceneryInstancer.flush();
  }

  setLevel(level) {
    this.currentLevel = level;
    const levelData = levels.find((l) => l.id === level);
    if (levelData) {
      this.levelBaseSpeed = 30 * levelData.speedMultiplier;
      this.speed = this.levelBaseSpeed;
      this.spawnDirector.resetForLevel();
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
      // Start "already spaced" so the very first coin trail encountered
      // can deal a feature immediately, rather than making the player run
      // the first ~90 units with nothing to collect.
      this._distanceSinceLastFeature = FEATURE_SPACING_DISTANCE;
    }
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
    if (!this.levelFeatures || this.levelFeatures.length === 0) return undefined;
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
  _refreshChunkContent(i, hasScenery) {
    const coinSlots = this.chunkCoins[i];
    const obstacleSlots = this.chunkObstacles[i];

    for (const coin of coinSlots) coin.group.visible = false;
    for (const slot of obstacleSlots) {
      if (slot.activeType) slot.variants[slot.activeType].group.visible = false;
      slot.activeType = null;
    }

    if (!hasScenery) return;

    const pattern = this.spawnDirector.selectPattern(this.spawnDirector.getMaxDifficulty(), this.speed);

    pattern.obstacles.forEach((obs, idx) => {
      if (idx >= obstacleSlots.length) return; // safety net; no authored pattern exceeds MAX_OBSTACLE_SLOTS
      const slot = obstacleSlots[idx];
      const instance = slot.variants[obs.type];
      slot.activeType = obs.type;

      const x =
        obs.lanes.length === 2
          ? (PLAYER_PHYSICS.lanes[obs.lanes[0]] + PLAYER_PHYSICS.lanes[obs.lanes[1]]) / 2
          : PLAYER_PHYSICS.lanes[obs.lanes[0]];
      instance.group.position.set(x, 0, obs.z);

      // Pain-point NAMING is independent of the visual/physical obstacle
      // type -- GameContent.js's blockers are pain-point concepts, not tied
      // to a specific shape -- so any of the 4 types can carry any pain
      // point, picked with replacement exactly as the old single-blocker
      // model did (blockers are meant to recur often, unlike coins).
      const painPoint =
        this.blockersToSpawn.length > 0
          ? this.blockersToSpawn[Math.floor(Math.random() * this.blockersToSpawn.length)]
          : null;
      instance.group.userData = {
        isInteractable: true,
        type: "blocker",
        name: painPoint ? painPoint.id : obs.type,
        text: painPoint ? painPoint.text : "",
        consequence: painPoint ? painPoint.consequence : "",
      };
      instance.group.visible = true;
    });

    pattern.coins.forEach((coinDef, idx) => {
      if (idx >= coinSlots.length) return;
      // Pace NEW feature dealing across the level's real run length (see
      // FEATURE_SPACING_DISTANCE) -- without this gate, dense per-recycle
      // coin-slot population deals all of a level's features within the
      // first ~15s instead of across the plan's ~60-75s target. A slot
      // that's gated simply shows no coin this time, which is a perfectly
      // normal-looking sparser trail, not a broken/partial one.
      if (this._distanceSinceLastFeature < FEATURE_SPACING_DISTANCE) return;
      const featureData = this._nextFeature();
      if (!featureData) return; // setLevel() never called yet -- defensive, shouldn't happen in practice
      this._distanceSinceLastFeature = 0;

      const coin = coinSlots[idx];
      // Power-ups (Milestone 6): both map onto specific real features in
      // Level 2's list, keyed by exact name -- collecting that feature coin
      // IS the power-up pickup. Gets a distinct glowing material instead of
      // the usual admin/business gold-or-cyan so it reads as special
      // in-world, before the player even knows what it does.
      const powerUpDef = POWER_UPS[featureData.name];
      const isAdmin = featureData.category.includes("Admin");
      const mat = powerUpDef ? this.powerUpMat : isAdmin ? this.adminMat : this.businessMat;
      coin.ring.material = mat;
      coin.plate.material = mat;
      coin.innerRing.material = mat;
      coin.baseY = coinDef.y ?? 1.2;
      coin.group.position.set(PLAYER_PHYSICS.lanes[coinDef.lane], coin.baseY, coinDef.z);
      coin.bobOffset = Math.random() * Math.PI * 2;
      coin.group.userData = {
        isInteractable: true,
        type: "coin",
        name: featureData.name,
        category: featureData.category,
        isExclusive: featureData.isExclusive || false,
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
    this.speed = this.spawnDirector.getRampedSpeed(this.levelBaseSpeed);
    const moveDist = this.speed * delta;
    this.spawnDirector.advance(moveDist);
    this._distanceSinceLastFeature += moveDist;

    const sceneryReady = this.sceneryInstancer.ready;
    const time = Date.now() * 0.005;

    for (let i = 0; i < this.trackPool.length; i++) {
      const chunk = this.trackPool[i];
      chunk.position.z += moveDist;

      for (const coin of this.chunkCoins[i]) {
        if (coin.group.visible) {
          coin.group.rotation.y += 3 * delta;
          coin.group.position.y = coin.baseY + Math.sin(time + coin.bobOffset) * 0.2;
          if (coin.group.userData.powerUp) {
            // Shared material across every power-up coin (at most 1-2 are
            // ever visible at once, given only 2 power-up features exist
            // total) -- a synchronized pulse is a fine, simple tell.
            const pulse = 0.6 + Math.sin(time * 6) * 0.4;
            this.powerUpMat.emissiveIntensity = pulse;
          }
        }
      }
      for (const slot of this.chunkObstacles[i]) {
        if (slot.activeType) slot.variants[slot.activeType].update(time);
      }

      if (chunk.position.z > this.activeZ + this.trackLength) {
        let minZ = Infinity;
        for (let j = 0; j < this.trackPool.length; j++) {
          if (this.trackPool[j].position.z < minZ) minZ = this.trackPool[j].position.z;
        }
        chunk.position.z = minZ - this.trackLength;

        // Base ~50% density, scaled toward 0.5*densityRampMultiplier as the
        // level progresses, capped well under 1.0 so "breather" chunks with
        // no content never disappear entirely even at max ramp.
        const sceneryChance = Math.min(0.9, 0.5 * this.spawnDirector.getDensityFactor());
        let hasScenery = Math.random() < sceneryChance;
        if (sceneryReady) {
          this.sceneryInstancer.rerollChunk(this.chunkManifests[i], hasScenery);
          hasScenery = this.chunkManifests[i].hasScenery;
        }
        this._refreshChunkContent(i, hasScenery);
      }

      // Sync exactly once per chunk per frame, using whatever the final Z
      // ended up being this frame (recycled or not) -- avoids writing scenery
      // matrices twice on a recycle frame only to discard the first write.
      if (sceneryReady) {
        this.sceneryInstancer.syncChunk(this.chunkManifests[i], chunk.position.z);
      }
    }

    if (sceneryReady) this.sceneryInstancer.flush();
  }
}
