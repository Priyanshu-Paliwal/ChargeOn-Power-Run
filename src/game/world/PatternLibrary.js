// Authored track segments, replacing the old "random lane, 50/50
// coin-or-blocker, every other chunk" spawn logic -- the root cause both
// of the unwinnable level (near-zero coin density) and of flat, unreadable
// pacing (every chunk statistically identical). Each pattern is a full
// ~20-unit segment (sized to fit one WorldStreamer chunk) combining
// obstacle placements AND a coin trail, exactly as the plan describes a
// pattern: not just an obstacle list.
//
// Lanes are resolved to CONCRETE indices (0/1/2, matching
// PLAYER_PHYSICS.lanes) at BUILD time via build(), not hardcoded in the
// pattern definition -- an abstract "random lane" or "random adjacent
// pair" resolves differently every time the same pattern is selected, so
// a small authored set yields much more real variety than its raw count
// suggests. SpawnDirector re-verifies solvability on the CONCRETE result
// regardless (defense in depth -- see SpawnDirector.js).
//
// Every obstacle entry uses a uniform `lanes: [...]` array (length 1 for
// BARRICADE_LOW/DRONE_LOW/DRONE_HIGH, length 2 for BARRICADE_WIDE) so
// downstream code never needs to branch on obstacle type to know which
// lanes are occupied.
//
// Coin feature-NAME assignment (which of the level's 54 features a given
// slot represents) is WorldStreamer's job (Milestone 6) -- these only
// define WHERE a coin trail sits relative to the obstacles, not which
// feature pops next.
//
// Coins default to running height (WorldStreamer's 1.2) unless a `y` is
// given explicitly. The few coins placed in a BARRICADE_LOW's own lane at
// its own z are raised to COIN_JUMP_REWARD_HEIGHT (the jump apex) so the
// trail visually traces the jump arc and actually sits inside the
// airborne hitbox at the moment it matters -- at running height they'd be
// grabbed by simply standing in that lane, never rewarding the jump
// itself. This is also what makes these solo/combo patterns genuine
// risk/reward coin-trail shapes: the coins sit in the obstacle's own lane
// (never the safe adjacent one), so grabbing them means committing to
// clearing the obstacle instead of just switching around it.

import { COIN_JUMP_REWARD_HEIGHT } from "../config/GameConfig.js";

function randomLane() {
  return Math.floor(Math.random() * 3);
}

function randomLaneExcept(excluded) {
  const opts = [0, 1, 2].filter((l) => !excluded.includes(l));
  return opts[Math.floor(Math.random() * opts.length)];
}

// The only 2 ways to pick 2 ADJACENT lanes out of 3: (0,1) leaving 2 free,
// or (1,2) leaving 0 free. (0,2) are not adjacent -- lane 1 sits between
// them -- so a "wide" obstacle spanning non-adjacent lanes would be a
// visual/physical nonsense (floating over the middle lane), never used.
function randomAdjacentPair() {
  return Math.random() < 0.5 ? { lanes: [0, 1], freeLane: 2 } : { lanes: [1, 2], freeLane: 0 };
}

export const PATTERNS = [
  {
    id: "solo-barricade-low",
    difficulty: 1,
    skills: ["jump"],
    build() {
      const lane = randomLane();
      return {
        obstacles: [{ type: "BARRICADE_LOW", lanes: [lane], z: 0 }],
        coins: [
          { lane, z: -4, y: 1.4 },
          { lane, z: 0, y: COIN_JUMP_REWARD_HEIGHT },
          { lane, z: 4, y: 1.4 },
        ],
      };
    },
  },
  {
    id: "solo-barricade-wide",
    difficulty: 1,
    skills: ["switch"],
    build() {
      const { lanes, freeLane } = randomAdjacentPair();
      return {
        obstacles: [{ type: "BARRICADE_WIDE", lanes, z: 0 }],
        coins: [
          { lane: freeLane, z: -4 },
          { lane: freeLane, z: 0 },
          { lane: freeLane, z: 4 },
        ],
      };
    },
  },
  {
    id: "solo-drone-low",
    difficulty: 1,
    skills: ["slide"],
    build() {
      const lane = randomLane();
      return {
        obstacles: [{ type: "DRONE_LOW", lanes: [lane], z: 0 }],
        // Coins under the drone reward committing to the slide; a couple
        // more in an adjacent lane give a switch-instead option too.
        coins: [
          { lane, z: -3 },
          { lane, z: 3 },
          { lane: randomLaneExcept([lane]), z: 0 },
        ],
      };
    },
  },
  {
    id: "solo-drone-high",
    difficulty: 2,
    skills: ["switch"],
    build() {
      const lane = randomLane();
      const freeLane = randomLaneExcept([lane]);
      return {
        obstacles: [{ type: "DRONE_HIGH", lanes: [lane], z: 0 }],
        coins: [
          { lane: freeLane, z: -4 },
          { lane: freeLane, z: 0 },
          { lane: freeLane, z: 4 },
        ],
      };
    },
  },
  {
    id: "double-barricade-low",
    difficulty: 2,
    skills: ["jump", "switch"],
    build() {
      const laneA = randomLane();
      const laneB = randomLaneExcept([laneA]);
      const freeLane = randomLaneExcept([laneA, laneB]);
      return {
        obstacles: [
          { type: "BARRICADE_LOW", lanes: [laneA], z: 0 },
          { type: "BARRICADE_LOW", lanes: [laneB], z: 0 },
        ],
        coins: [
          { lane: freeLane, z: -4 },
          { lane: freeLane, z: 4 },
        ],
      };
    },
  },
  {
    id: "double-drone-low",
    difficulty: 2,
    skills: ["slide", "switch"],
    build() {
      const laneA = randomLane();
      const laneB = randomLaneExcept([laneA]);
      const freeLane = randomLaneExcept([laneA, laneB]);
      return {
        obstacles: [
          { type: "DRONE_LOW", lanes: [laneA], z: 0 },
          { type: "DRONE_LOW", lanes: [laneB], z: 0 },
        ],
        coins: [
          { lane: freeLane, z: -4 },
          { lane: freeLane, z: 4 },
        ],
      };
    },
  },
  {
    id: "double-drone-high",
    difficulty: 3,
    skills: ["switch"],
    build() {
      const laneA = randomLane();
      const laneB = randomLaneExcept([laneA]);
      const freeLane = randomLaneExcept([laneA, laneB]);
      return {
        obstacles: [
          { type: "DRONE_HIGH", lanes: [laneA], z: 0 },
          { type: "DRONE_HIGH", lanes: [laneB], z: 0 },
        ],
        coins: [
          { lane: freeLane, z: -4 },
          { lane: freeLane, z: 4 },
        ],
      };
    },
  },
  {
    id: "double-drone-mixed",
    difficulty: 2,
    skills: ["slide", "switch"],
    build() {
      const laneA = randomLane();
      const laneB = randomLaneExcept([laneA]);
      const freeLane = randomLaneExcept([laneA, laneB]);
      return {
        obstacles: [
          { type: "DRONE_LOW", lanes: [laneA], z: 0 },
          { type: "DRONE_HIGH", lanes: [laneB], z: 0 },
        ],
        coins: [{ lane: freeLane, z: 0 }],
      };
    },
  },
  {
    id: "combo-low-then-wide",
    difficulty: 3,
    skills: ["jump", "switch", "combo"],
    build() {
      const lowLane = randomLane();
      const { lanes: wideLanes, freeLane: wideFree } = randomAdjacentPair();
      return {
        obstacles: [
          { type: "BARRICADE_LOW", lanes: [lowLane], z: -5 },
          { type: "BARRICADE_WIDE", lanes: wideLanes, z: 4 },
        ],
        coins: [
          { lane: lowLane, z: -7, y: COIN_JUMP_REWARD_HEIGHT },
          { lane: wideFree, z: 6 },
        ],
      };
    },
  },
  {
    id: "combo-wide-then-low",
    difficulty: 3,
    skills: ["switch", "jump", "combo"],
    build() {
      const { lanes: wideLanes, freeLane: wideFree } = randomAdjacentPair();
      const lowLane = randomLane();
      return {
        obstacles: [
          { type: "BARRICADE_WIDE", lanes: wideLanes, z: -5 },
          { type: "BARRICADE_LOW", lanes: [lowLane], z: 4 },
        ],
        coins: [
          { lane: wideFree, z: -7 },
          { lane: lowLane, z: 6, y: COIN_JUMP_REWARD_HEIGHT },
        ],
      };
    },
  },
  {
    id: "combo-high-then-low",
    difficulty: 3,
    skills: ["switch", "slide", "combo"],
    build() {
      const highLane = randomLane();
      const lowLane = randomLane();
      return {
        obstacles: [
          { type: "DRONE_HIGH", lanes: [highLane], z: -5 },
          { type: "DRONE_LOW", lanes: [lowLane], z: 4 },
        ],
        coins: [
          { lane: randomLaneExcept([highLane]), z: -7 },
          { lane: lowLane, z: 6 },
        ],
      };
    },
  },
  {
    id: "gauntlet-three",
    difficulty: 4,
    skills: ["jump", "switch", "slide", "combo"],
    build() {
      const lowLane = randomLane();
      const { lanes: wideLanes, freeLane: wideFree } = randomAdjacentPair();
      const droneLane = randomLane();
      return {
        obstacles: [
          { type: "BARRICADE_LOW", lanes: [lowLane], z: -8 },
          { type: "BARRICADE_WIDE", lanes: wideLanes, z: 0 },
          { type: "DRONE_LOW", lanes: [droneLane], z: 8 },
        ],
        coins: [
          { lane: lowLane, z: -10, y: COIN_JUMP_REWARD_HEIGHT },
          { lane: wideFree, z: 0 },
          { lane: droneLane, z: 10 },
        ],
      };
    },
  },
  {
    id: "empty-coin-trail",
    difficulty: 0,
    skills: [],
    build() {
      // A breather: no obstacles, just a coin trail weaving across lanes --
      // pacing variety, and a guaranteed-safe pattern for the easiest
      // difficulty band / right after a hit.
      const start = randomLane();
      const mid = randomLaneExcept([start]);
      const end = randomLaneExcept([mid]);
      return {
        obstacles: [],
        coins: [
          { lane: start, z: -4 },
          { lane: mid, z: 0 },
          { lane: end, z: 4 },
        ],
      };
    },
  },
];
