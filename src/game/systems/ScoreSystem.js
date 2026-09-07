import { SCORE_POINTS, NEAR_MISS_SCORE_BONUS } from "../config/GameConfig.js";

// Owned by Engine.js, fed purely by discrete coin-collection events from
// CollisionSystem's onHit payload -- Vue never computes score itself, it
// only displays whatever the engine reports over the same onCollide
// callback every other cross-boundary value (feature name, blocker text)
// already flows through.
//
// Deliberately counts EVERY coin hit, including a feature the player has
// already collected before (WorldStreamer's shuffled bag can re-deal an
// already-owned feature on a later refill) -- score rewards the reflexes
// of grabbing a coin at all, which is a separate concern from
// levelFeaturesCollected's "is this new required progress" count in
// App.vue.
export class ScoreSystem {
  constructor() {
    this.score = 0;
    this.coinsCollected = 0;
  }

  registerCoinByType({ isGold, isPink, isBlue, powerUp, name } = {}) {
    let points = SCORE_POINTS.coinBlue; // default +100
    if (name === "Jetpack" || powerUp === "jetpack") {
      points = SCORE_POINTS.jetpackCollect; // +50
    } else if (name === "Surfboard" || name === "Skateboard" || powerUp === "board") {
      points = SCORE_POINTS.hoverboardCollect; // +50
    } else if (isPink || powerUp === "magnet" || powerUp === "shield") {
      points = SCORE_POINTS.coinPink; // +100
    } else if (isGold) {
      points = SCORE_POINTS.coinGold; // +150
    } else {
      points = SCORE_POINTS.coinBlue; // +100
    }

    this.score += points;
    this.coinsCollected++;
    return { points, total: this.score };
  }

  // Legacy fallback delegating to registerCoinByType
  registerCoin(hit = {}) {
    const isGold = hit.coinType === "gold" || (hit.category && hit.category.includes("Admin"));
    const isPink = hit.coinType === "pink" || hit.powerUp === "magnet" || hit.powerUp === "shield";
    const isBlue = hit.coinType === "blue" || (!isGold && !isPink && !hit.powerUp);
    return this.registerCoinByType({
      isGold,
      isPink,
      isBlue,
      powerUp: hit.powerUp,
      name: hit.name,
    });
  }

  // Blocker / Drone collision penalty (-50 for blockers, -25 for drones)
  // Clamped so score never falls below 0.
  registerObstacleHit(obstacleType) {
    const isDrone = obstacleType === "DRONE_LOW" || obstacleType === "DRONE_HIGH";
    const penalty = isDrone ? SCORE_POINTS.hitDrone : SCORE_POINTS.hitBlocker;
    this.score = Math.max(0, this.score + penalty);
    return { points: penalty, total: this.score };
  }

  // Flawless Run Bonus (+300 pts) for clearing all 3 levels without losing any life
  applyFlawlessBonus() {
    this.score += SCORE_POINTS.flawlessRunBonus;
    return { points: SCORE_POINTS.flawlessRunBonus, total: this.score };
  }

  // Milestone 9: a small bonus for clearing a same-lane jump/slide-escape
  // obstacle without a hit (CollisionSystem._checkNearMiss). Same
  // total-tracking shape as registerCoin() so Engine._handleHit can treat
  // both uniformly.
  registerNearMiss() {
    this.score += NEAR_MISS_SCORE_BONUS;
    return { points: NEAR_MISS_SCORE_BONUS, total: this.score };
  }

  reset() {
    this.score = 0;
    this.coinsCollected = 0;
  }
}
