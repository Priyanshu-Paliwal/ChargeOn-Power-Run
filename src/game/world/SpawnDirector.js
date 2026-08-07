import { PATTERNS } from "./PatternLibrary.js";
import {
  OBSTACLE_TYPES,
  MIN_OBSTACLE_GAP_SECONDS,
  PATTERN_NO_REPEAT_WINDOW,
  DIFFICULTY_RAMP,
  REACTION_BASE_SPEED,
  FRAMING,
} from "../config/GameConfig.js";

// Verifies a resolved (concrete-lane) obstacle list is solvable: at every
// distinct z where obstacles exist, at least one of the 3 lanes is
// passable -- either empty, or occupied by an obstacle whose escape is
// "jump" or "slide" rather than "switch" (a lane you can only get past by
// not being in it at all). Exported standalone so it can run both
// defensively inside selectPattern() AND directly against a deliberately
// broken input in tests -- this is the concrete mechanism behind the
// plan's "randomly generating an impossible wall becomes structurally
// impossible," not just a hope that authored patterns are correct.
export function checkSolvability(obstacles) {
  const byZ = new Map();
  for (const obs of obstacles) {
    if (!byZ.has(obs.z)) byZ.set(obs.z, [null, null, null]);
    const laneState = byZ.get(obs.z);
    for (const lane of obs.lanes) laneState[lane] = obs.type;
  }
  for (const [z, laneState] of byZ) {
    const passable = laneState.some((type) => type === null || OBSTACLE_TYPES[type].escape !== "switch");
    if (!passable) return { solvable: false, z };
  }
  return { solvable: true };
}

// Smallest gap (world units) between any 2 distinct obstacle z-groups in
// this pattern. Infinity for 0 or 1 group -- nothing to violate.
function minInternalGap(obstacles) {
  const zs = [...new Set(obstacles.map((o) => o.z))].sort((a, b) => a - b);
  if (zs.length < 2) return Infinity;
  let min = Infinity;
  for (let i = 1; i < zs.length; i++) min = Math.min(min, zs[i] - zs[i - 1]);
  return min;
}

// Selects patterns for upcoming chunks (difficulty-gated, variety-
// enforced, solvability-verified) and owns the intra-level difficulty
// ramp. One instance lives on WorldStreamer for the whole game session;
// resetForLevel() is called from setLevel().
export class SpawnDirector {
  constructor() {
    this._recentIds = [];
    this._distanceTraveled = 0;
  }

  resetForLevel() {
    this._distanceTraveled = 0;
    this._recentIds = [];
  }

  // Call once per frame with however far the world moved this frame
  // (speed * delta), so the ramp tracks DISTANCE traveled, not wall-clock
  // time -- a slower player takes longer in real seconds but experiences
  // the same ramp over the same ground covered.
  advance(moveDist) {
    this._distanceTraveled += moveDist;
  }

  _rampT() {
    return Math.min(this._distanceTraveled / DIFFICULTY_RAMP.rampDistance, 1);
  }

  // In-level speed, ramping from the level's own base up toward
  // base * speedRampMultiplier as the player travels through the level.
  getRampedSpeed(levelBaseSpeed) {
    return levelBaseSpeed * (1 + (DIFFICULTY_RAMP.speedRampMultiplier - 1) * this._rampT());
  }

  // 1.0 at the start of a level, ramping toward densityRampMultiplier --
  // WorldStreamer uses this to scale the ~50% chance a given chunk gets
  // any obstacle/coin content at all (never above a hard cap -- always
  // having content everywhere would remove the pacing "breather" chunks
  // are meant to provide, at ANY point in a level).
  getDensityFactor() {
    return 1 + (DIFFICULTY_RAMP.densityRampMultiplier - 1) * this._rampT();
  }

  // 1 at level start (only the simplest solo patterns eligible), ramping
  // to 4 (everything, including the 3-obstacle gauntlet) as the level
  // progresses -- this is the other half of "density ramps with distance":
  // not just how OFTEN a chunk has content, but how demanding that content
  // is allowed to be.
  getMaxDifficulty() {
    return Math.floor(1 + 3 * this._rampT());
  }

  // The plan's "minimum reaction distance" guarantee -- nothing spawns
  // closer than lookAheadZ, scaled so reactionTime stays constant in
  // SECONDS as speed increases -- is satisfied STRUCTURALLY by this
  // architecture, not by an active per-spawn check: a pattern is only ever
  // instantiated when a chunk recycles to the back of the pool, which
  // sits roughly poolSize*trackLength from the player (~270 units at the
  // current 15x20 pool), always far beyond even a heavily speed-scaled
  // lookAheadZ. This getter makes that fact explicit and checkable --
  // WorldStreamer asserts pool-depth against it once at startup -- rather
  // than leaving it an implicit, unverified assumption of the chunk
  // architecture.
  dynamicLookAheadZ(currentSpeed) {
    return FRAMING.lookAheadZ * (currentSpeed / REACTION_BASE_SPEED);
  }

  // Picks and instantiates the next pattern. `maxDifficulty` gates which
  // patterns are eligible; `currentSpeed` filters out patterns whose
  // authored internal spacing is too tight to stay fair at that speed
  // (see MIN_OBSTACLE_GAP_SECONDS) -- naturally biasing toward simpler
  // patterns as the game accelerates rather than an outright ban.
  selectPattern(maxDifficulty, currentSpeed) {
    const eligible = PATTERNS.filter((p) => p.difficulty <= maxDifficulty);
    const pool = eligible.length > 0 ? eligible : PATTERNS;
    const gapRequired = MIN_OBSTACLE_GAP_SECONDS * currentSpeed;

    const MAX_ATTEMPTS = 10;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const pattern = pool[Math.floor(Math.random() * pool.length)];
      // Relax the variety constraint on the last couple of attempts so
      // this can't spin for all 10 tries when the eligible pool is
      // smaller than the no-repeat window.
      const enforceVariety = attempt < MAX_ATTEMPTS - 2;
      if (enforceVariety && this._recentIds.includes(pattern.id)) continue;

      const built = pattern.build();
      if (minInternalGap(built.obstacles) < gapRequired) continue;

      const solvability = checkSolvability(built.obstacles);
      if (!solvability.solvable) continue; // structurally impossible wall -- reject, try another

      this._recordSelection(pattern.id);
      return { id: pattern.id, obstacles: built.obstacles, coins: built.coins };
    }

    // Every attempt failed (should be unreachable with a well-authored
    // library, but never leave a chunk unresolved) -- the empty coin
    // trail has zero obstacles, so it trivially passes both checks.
    const safe = PATTERNS.find((p) => p.id === "empty-coin-trail");
    const built = safe.build();
    this._recordSelection(safe.id);
    return { id: safe.id, obstacles: built.obstacles, coins: built.coins };
  }

  _recordSelection(id) {
    this._recentIds.push(id);
    if (this._recentIds.length > PATTERN_NO_REPEAT_WINDOW) this._recentIds.shift();
  }
}
