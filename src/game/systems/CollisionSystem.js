import * as THREE from "three";
import {
  COLLISION_FIXED_DT,
  COLLISION_MAX_STEPS_PER_FRAME,
  COLLISION_Z_BAND,
  MAGNET_HALF_WIDTH,
  OBSTACLE_TYPES,
} from "../config/GameConfig.js";

const _worldPos = new THREE.Vector3();
const _itemBox = new THREE.Box3();
const _playerBox = new THREE.Box3();

// Replaces Engine.js's per-render-frame checkCollisions(). That version
// tested only the CURRENT z position against a fixed +-2 band once per
// rendered frame -- at level-3 speed (48 u/s), a single 100ms stutter
// moves an obstacle 4.8 units, more than the 4-unit-wide band, meaning the
// obstacle's z could be on one side of the band on frame N and the other
// side on frame N+1 without ever registering as "inside" it, letting the
// player run straight through with no hit and no coin credit.
//
// Fix: accumulate real time and process collision checks in fixed 1/60s
// steps (bounded per render frame so a huge stall can't spiral). Within a
// frame, an interactable's actual three.js position only changes once (via
// WorldStreamer.update(), which still runs at the real framerate) -- world
// scroll is uniform-velocity, so linearly interpolating each item's z
// between its last-checked position and its current one exactly
// reconstructs the true intermediate positions. Each fixed step checks ITS
// OWN sub-span of that interpolated path (not just the endpoint) against
// the player's current hitbox, so the full frame-to-frame movement is
// covered by the union of sub-spans -- nothing can pass through unseen,
// regardless of framerate.
//
// Scope note: this interpolates the INTERACTABLE's motion (the risk the
// plan explicitly calls out -- fast-moving obstacles vs a comparatively
// static player), not the player's own motion within the same frame. A
// player mid-jump-arc during an extreme stutter uses their end-of-frame
// hitbox for every sub-step this frame, not an interpolated one. Full
// two-sided interpolation would close that last, much narrower edge case
// (needs a severe stall AND to land exactly on a jump-arc boundary) at
// real added complexity; deliberately deferred rather than guessed at.
export class CollisionSystem {
  constructor({
    fixedDt = COLLISION_FIXED_DT,
    maxStepsPerFrame = COLLISION_MAX_STEPS_PER_FRAME,
    zBand = COLLISION_Z_BAND,
  } = {}) {
    this.fixedDt = fixedDt;
    this.maxStepsPerFrame = maxStepsPerFrame;
    this.zBand = zBand;
    this._accumulator = 0;
    this._track = new WeakMap(); // item -> { prevZ, wasVisible }
  }

  // `player` must expose `.model`, `.mesh.position`, `.writeHitboxBox3(box)`,
  // `.takeHit()`. `world` must expose `.trackPool` (array of chunk Groups
  // whose children include the pooled coin/blocker Object3Ds). `onHit(payload)`
  // is called once per newly-detected hit, matching the original's contract.
  update(realDelta, player, world, onHit) {
    if (!player.model) return;

    this._accumulator += realDelta;
    const steps = Math.min(Math.floor(this._accumulator / this.fixedDt), this.maxStepsPerFrame);
    if (steps === 0) return;

    // Consumed exactly what was processed; if capped by maxStepsPerFrame
    // during an extreme stall, drop the rest rather than let it spiral
    // into an ever-growing backlog of owed steps.
    this._accumulator =
      steps === this.maxStepsPerFrame ? 0 : this._accumulator - steps * this.fixedDt;

    const trackPool = world.trackPool;
    for (let i = 0; i < trackPool.length; i++) {
      const chunk = trackPool[i];
      for (let j = 0; j < chunk.children.length; j++) {
        const item = chunk.children[j];
        if (!item.userData || !item.userData.isInteractable) continue;
        if (item.userData.type !== "coin" && item.userData.type !== "blocker") continue;

        this._checkItem(item, steps, player, onHit);
      }
    }
  }

  _checkItem(item, steps, player, onHit) {
    let entry = this._track.get(item);
    if (!entry) {
      entry = { prevZ: 0, wasVisible: false, nearMissChecked: false };
      this._track.set(item, entry);
    }

    if (!item.visible) {
      entry.wasVisible = false;
      return;
    }

    item.getWorldPosition(_worldPos);
    const curZ = _worldPos.z;

    if (!entry.wasVisible) {
      // Freshly activated (spawned/recycled this item) -- establish the
      // baseline without sweeping from a stale, possibly-unrelated
      // position it happened to be at before. Also resets nearMissChecked
      // for THIS activation -- the same pooled obstacle slot gets reused
      // many times over a run, and each activation deserves its own
      // near-miss opportunity.
      entry.prevZ = curZ;
      entry.wasVisible = true;
      entry.nearMissChecked = false;
      return;
    }

    const prevZ = entry.prevZ;
    entry.prevZ = curZ;

    // Cheap cull: does the FULL span this item moved (across however many
    // fixed steps we're processing) even reach the collision band at all?
    const spanLo = Math.min(prevZ, curZ);
    const spanHi = Math.max(prevZ, curZ);
    if (spanHi >= -this.zBand && spanLo <= this.zBand) {
      // Subdivide the span into `steps` equal sub-intervals -- each is
      // checked against the player's CURRENT hitbox (see class comment for
      // why the player side isn't also interpolated).
      for (let k = 1; k <= steps; k++) {
        const subPrevZ = lerp(prevZ, curZ, (k - 1) / steps);
        const subCurZ = lerp(prevZ, curZ, k / steps);
        const lo = Math.min(subPrevZ, subCurZ);
        const hi = Math.max(subPrevZ, subCurZ);
        if (hi < -this.zBand || lo > this.zBand) continue;

        if (this._overlapsPlayer(item, subCurZ, player)) {
          this._reportHit(item, player, onHit);
          return; // a real hit -- never a near-miss for this crossing, and the item is now hidden
        }
      }
    }

    // No hit was registered above. The instant this obstacle finishes
    // crossing from at-or-ahead-of the back band edge to fully behind it,
    // check whether it was a genuine close call (Milestone 9) -- by
    // construction, "was in the player's lane, is now behind, was never
    // hit" can only mean a jump/slide-escape obstacle was successfully
    // cleared with correct timing, not just avoided from a different lane.
    if (item.userData.type === "blocker" && !entry.nearMissChecked && curZ < -this.zBand && prevZ >= -this.zBand) {
      entry.nearMissChecked = true;
      this._checkNearMiss(item, player, onHit);
    }
  }

  _checkNearMiss(item, player, onHit) {
    const def = OBSTACLE_TYPES[item.userData.obstacleType];
    if (!def || (def.escape !== "jump" && def.escape !== "slide")) return; // switch-escape obstacles: being in a different lane the whole time isn't a "near" miss
    if (!item.userData.lanes || !item.userData.lanes.includes(player.currentLane)) return;
    onHit({ type: "nearmiss" });
  }

  // Full 3D box test at the item's actual current transform (not a
  // synthetic swept box) for the sub-step's approximate z, matching the
  // original's exact collision semantics (Box3.setFromObject vs the
  // player's capsule-ish box) -- the swept interval above is purely a
  // cheap temporal cull, not a change to what "overlap" means.
  _overlapsPlayer(item, approxZ, player) {
    _itemBox.setFromObject(item);
    // Re-center the item's box on the sub-step's interpolated z so a
    // fast-moving item is tested at the moment it's actually swept through,
    // not only at its final end-of-frame position.
    const zOffset = approxZ - (_itemBox.min.z + _itemBox.max.z) / 2;
    _itemBox.min.z += zOffset;
    _itemBox.max.z += zOffset;

    player.writeHitboxBox3(_playerBox);

    // Magnet (Milestone 6): while active, a coin only needs to reach the
    // collision z-band at all -- lane no longer matters. Widen the
    // player's box to the full lane span instead of giving the coin any
    // special-cased movement, so this stays a pure collision-test change.
    if (item.userData.type === "coin" && player.hasMagnet) {
      _playerBox.min.x = -MAGNET_HALF_WIDTH;
      _playerBox.max.x = MAGNET_HALF_WIDTH;
    }

    return _playerBox.intersectsBox(_itemBox);
  }

  _reportHit(item, player, onHit) {
    item.visible = false;

    if (item.userData.type === "coin") {
      onHit({
        type: "coin",
        name: item.userData.name,
        category: item.userData.category,
        isExclusive: item.userData.isExclusive,
        exclusiveLine: item.userData.exclusiveLine || null,
        powerUp: item.userData.powerUp || null,
        powerUpDurationMs: item.userData.powerUpDurationMs,
        // Shared scratch vector, NOT a fresh allocation -- safe here only
        // because Engine._handleHit() (the sole onHit consumer) reads/
        // copies it synchronously, in the same call stack, before the next
        // loop iteration's item.getWorldPosition(_worldPos) overwrites it.
        // Milestone 9's coin-burst particle effect is the reader; it must
        // NOT be forwarded past Engine.js (e.g. into the Vue-facing
        // onCollide payload) since by the time Vue observes it later it
        // would be stale/overwritten.
        worldPosition: _worldPos,
      });
    } else if (item.userData.type === "blocker") {
      // takeHit() returns false if a shield absorbed it -- App.vue's
      // authoritative life counter and game-over check need to know which
      // outcome actually happened, not just that SOME blocker was touched.
      const damaged = player.takeHit();
      onHit({
        type: damaged ? "blocker" : "shielded",
        name: item.userData.name,
        text: item.userData.text,
        consequence: item.userData.consequence,
        // Milestone 9 interactive tutorial: App.vue skips the life cost
        // (but still shows the normal feedback) for a miss on one of the
        // 3 seeded practice obstacles -- see WorldStreamer.startTutorial().
        isTutorial: item.userData.isTutorial || false,
      });
    }
  }
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}
