import { SCORE_POINTS } from "../config/GameConfig.js";

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

  registerCoin({ isExclusive }) {
    const points = SCORE_POINTS.coin + (isExclusive ? SCORE_POINTS.exclusiveBonus : 0);
    this.score += points;
    this.coinsCollected++;
    return { points, total: this.score };
  }

  reset() {
    this.score = 0;
    this.coinsCollected = 0;
  }
}
