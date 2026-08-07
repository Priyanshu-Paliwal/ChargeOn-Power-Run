// Every tunable number for the responsive core (Milestone 2) lives here so
// CameraRig, QualityManager and ViewportManager never hardcode a constant
// themselves. See docs/IMPLEMENTATION_PLAN.md, "Responsive design strategy".

// -----------------------------------------------------------------------
// Camera framing: the world-space volume that must always be visible,
// regardless of screen shape. CameraRig solves for whatever FOV makes this
// box fit, instead of using a fixed FOV (the root cause of lanes clipping
// off portrait screens and the character shrinking to a speck on desktop).
// -----------------------------------------------------------------------
export const FRAMING = {
  laneSpanX: 8.0, // 3 lanes (-3..3) plus a 1-unit margin each side
  headroomY: 6.0, // ground to comfortably above jump apex
  // MUST stay constant across every device. This is the fairness guarantee:
  // reactionTime = lookAheadZ / worldSpeed is the same in *seconds* on a
  // 360px phone and a 3440px ultrawide. Changing this changes how hard the
  // game is, silently, per device -- never tune this per screen size.
  lookAheadZ: 45.0,
};

// Camera solves for the larger of the two required FOVs, then clamps here
// so extreme aspect ratios can't force a degenerate near-zero or fisheye FOV.
export const CAMERA_FOV_RANGE = [35, 78];

// Physical camera placement, expressed relative to the player. Interpolated
// by aspect ratio -- portrait devices get the "portrait" rig, wide desktop
// monitors get "landscape", everything in between blends smoothly.
//
// distanceBehind is NOT a free aesthetic choice: fitting an 8-unit-wide
// play box from close range on a narrow screen requires a very wide FOV
// (e.g. ~96 deg at distance=8, aspect=0.45), which blows well past
// CAMERA_FOV_RANGE's 78 deg ceiling. Pulling the portrait camera back to
// ~13 units keeps the required FOV at a realistic phone aspect (~0.45)
// comfortably under that ceiling (verified: fovForX=68.7 deg with ~9 deg of
// margin). Height is raised to compensate so the view angle stays
// reasonably steep despite the extra distance, and lookAtForwardDistance is
// longer than landscape's -- using the taller portrait screen to show more
// track ahead, per the plan's "uses the tall screen for track-ahead" intent.
export const CAMERA_RIGS = {
  portrait: {
    height: 9.5, // camera eye height above ground
    distanceBehind: 13.0, // camera distance behind the player along +Z
    lookAtHeight: 1.4,
    lookAtForwardDistance: 10.0, // how far ahead (in -Z) the camera looks
    followFactor: 0.5, // how strongly camera X chases player X (weighty feel)
  },
  landscape: {
    height: 4.6,
    distanceBehind: 8.5,
    lookAtHeight: 1.8,
    lookAtForwardDistance: 7.0,
    followFactor: 0.5,
  },
};

// aspect <= 0.5 -> pure portrait rig, aspect >= 1.9 -> pure landscape rig,
// linear blend between. 0.5 covers the narrowest real phones (~9:19.5),
// 1.9 sits just past 16:9 so typical desktop monitors are fully landscape.
export const CAMERA_ASPECT_BLEND_RANGE = [0.5, 1.9];

// Time-to-mostly-settle (seconds) for the critically damped spring that
// replaced the old sine-wave chase-cam sway. Position lags slightly behind
// lookAt so turns still feel weighty without any jitter or overshoot.
export const CAMERA_SMOOTH_TIME = {
  position: 0.28,
  lookAt: 0.16,
};

// Lobby idle camera: a slow orbit around the character, expressed as the
// same target-position/lookAt shape the chase cam uses so both modes can
// share one spring-follow implementation in CameraRig.
export const LOBBY_ORBIT = {
  center: { x: 0, y: 1.2, z: 0 },
  radiusX: 1.5,
  radiusZ: 0.5,
  baseHeight: 1.5,
  heightAmplitude: 0.2,
  basePos: { x: 2, z: 4 },
  angularSpeed: { x: 0.2, y: 0.3, z: 0.1 },
  lookAt: { x: 0, y: 1.2, z: 0 },
};

// -----------------------------------------------------------------------
// Rendering quality tiers. QualityManager picks a starting tier from device
// signals, then can ratchet DOWN (never up, to avoid visible oscillation)
// if sustained FPS is too low. `antialias` only takes effect at renderer
// construction -- WebGL context can't change it live.
// -----------------------------------------------------------------------
export const QUALITY_TIERS = {
  high: {
    maxPixels: 2_000_000,
    dprMax: 2.0,
    shadowMapSize: 2048,
    shadows: true,
    bloom: true,
    antialias: true,
  },
  medium: {
    maxPixels: 1_600_000,
    dprMax: 1.5,
    shadowMapSize: 1024,
    shadows: true,
    bloom: true,
    antialias: true,
  },
  low: {
    maxPixels: 1_000_000,
    dprMax: 1.0,
    shadowMapSize: 512,
    shadows: false,
    bloom: false,
    antialias: false,
  },
};

// Order matters: index 0 is the best tier, ratcheting down walks forward.
export const QUALITY_TIER_ORDER = ["high", "medium", "low"];

export const QUALITY_DPR_FLOOR = 0.75;

// Rolling-average FPS monitoring for the live downgrade decision.
export const QUALITY_FPS_WINDOW = 90; // frames sampled for the rolling average
export const QUALITY_DOWNGRADE_FPS_THRESHOLD = 42; // sustained below this -> downgrade
export const QUALITY_DOWNGRADE_MIN_SAMPLES = 90; // don't judge before this many frames
export const QUALITY_DOWNGRADE_COOLDOWN_SAMPLES = 180; // frames to wait after a downgrade before judging again

// -----------------------------------------------------------------------
// ViewportManager size classes. Derived from aspect AND area together --
// never width alone -- because a 1024px tablet in portrait and a 1024px
// laptop are entirely different layout problems.
// -----------------------------------------------------------------------
export const SIZE_CLASS_RULES = {
  tvMinWidth: 1920,
  phonePortraitMaxAspect: 0.75,
  phoneLandscapeMinAspect: 1.6,
  phoneLandscapeMaxHeight: 500,
  tabletMinDim: 500,
  tabletPortraitMaxAspect: 1.0,
  tabletLandscapeMaxAspect: 1.6,
  desktopMinAspect: 1.3,
  desktopMinWidth: 1200,
};

// -----------------------------------------------------------------------
// Player physics, state-driven hitbox, and slide timing (Milestone 4).
//
// The obstacle taxonomy this is tuned against (Milestone 5 builds the
// obstacles themselves, but the physics has to make each one's answer
// physically true from day one):
//   BARRICADE_LOW  (1 lane, 0.0-1.0)  -- only escape: JUMP
//   BARRICADE_WIDE (2 lanes, 0.0-2.6) -- only escape: lane switch
//   DRONE_LOW      (1 lane, 1.1-3.0)  -- only escape: SLIDE
//   DRONE_HIGH     (1 lane, 0.35-2.6) -- only escape: lane switch
//
// The old jump (jumpForce=15, gravity=-40) had an apex of 15^2/(2*40) =
// 2.81 -- taller than DRONE_HIGH's 2.6 ceiling, meaning a well-timed jump
// could clear a "lane-switch-only" drone. Retuned so apex = exactly 2.0:
// clears BARRICADE_LOW's 1.0 top with margin, stays below DRONE_HIGH's 2.6
// the entire arc. Only jumpForce changes -- gravity is kept at the original
// -40 (already a known-good feel) rather than solving both simultaneously,
// which would just be a different, unverified feel for no extra benefit.
// jumpForce = sqrt(2 * apex * |gravity|) = sqrt(2 * 2.0 * 40) = sqrt(160).
export const PLAYER_PHYSICS = {
  gravity: -40,
  jumpForce: Math.sqrt(160), // ~12.649, apex exactly 2.0 at gravity=-40
  laneSwitchSpeed: 20,
  lanes: [-3, 0, 3],
};

// State-driven hitbox: CollisionSystem reads the capsule from the player's
// CURRENT state, not a constant. RUNNING and JUMPING share the same
// dimensions -- "raised by jump arc" just means the box follows the
// player's current Y (which naturally rises during a jump), not a separate
// jumping-specific size. Only SLIDING gets a distinct, short box.
export const PLAYER_HITBOX = {
  width: 1.2,
  depth: 1.2,
  runningHeight: 2.0, // RUNNING and JUMPING both use this
  slidingHeight: 0.9, // clears DRONE_LOW's 1.1 bottom; still hits everything else
};

// Slide is a committed timed state: once started it cannot be cancelled
// early (no slide-cancel exploit), and a short recovery window after it
// ends blocks an immediate re-slide/jump chain (prevents spamming into a
// near-permanent low hitbox). Replaces the old setTimeout that mutated the
// model's transform directly and had no cooldown at all.
export const SLIDE_DURATION_MS = 700;
// Must stay comfortably under INPUT_BUFFER_MS (120): if recovery took
// longer than the buffer window, a jump/slide buffered at ANY point during
// the slide would always have expired by the time recovery clears (buffer
// needs >= remaining-slide-time + recovery for ANY remaining-slide-time,
// which is only possible at all if recovery <= buffer). 100ms is still a
// real, perceptible anti-spam pause.
export const SLIDE_RECOVERY_MS = 100;

// Hit-reaction lock: how long input is ignored and the character flashes
// red after taking a blocker hit (matches the original's 1000ms lock).
export const HIT_REACTION_MS = 1000;

// -----------------------------------------------------------------------
// Input: keyboard + touch, with buffering for the two actions that have a
// "blocked" state (jump, slide -- lane-switch is never blocked, so it never
// needs buffering). If the player's input arrives up to this many ms before
// the blocking state clears, it fires the instant it can rather than being
// dropped -- a big part of why Subway-Surfers-style controls feel responsive.
// -----------------------------------------------------------------------
export const INPUT_BUFFER_MS = 120;

// Swipe recognition: distance is proportional to screen width (not a flat
// 30 CSS-px, which is a much bigger fraction of a small phone screen than a
// tablet) with a sane floor for very narrow screens. A swipe must also
// complete within maxDurationMs -- together, distance/time constraints are
// equivalent to a velocity threshold without needing to track intermediate
// touchmove samples.
export const SWIPE = {
  minDistanceRatio: 0.04, // 4% of screen width
  minDistancePx: 24, // floor for very small screens
  maxDurationMs: 400,
  tapMaxDurationMs: 250, // below the distance threshold AND this quick -> a deliberate tap, not a slow drag
};

// -----------------------------------------------------------------------
// Collision: fixed-timestep accumulator + swept Z-interval check. The old
// per-render-frame check tested only the CURRENT z position against a
// +-2 band; at level-3 speed (48 u/s) a single slow frame (say 100ms
// during a stutter) moves an obstacle 4.8 units -- enough to jump clean
// over the 4-unit-wide band between two samples with the naive check
// (never registering a hit despite the true path passing through it).
// Fixed-rate stepping bounds movement-per-check to a small, known amount;
// the swept interval check (does [prevZ, curZ] overlap the band, not just
// curZ) closes the remaining gap regardless of framerate.
// -----------------------------------------------------------------------
export const COLLISION_FIXED_DT = 1 / 60;
export const COLLISION_MAX_STEPS_PER_FRAME = 8; // drop excess after a big stall rather than spiral
export const COLLISION_Z_BAND = 2; // matches the original's "worldPos.z > 2 || < -2" cull

// -----------------------------------------------------------------------
// Obstacle taxonomy (Milestone 5). These height bands are the OTHER half
// of Milestone 4's state-driven hitbox -- PLAYER_HITBOX above was tuned
// specifically so each obstacle here has exactly one valid escape:
//   RUNNING/JUMPING hitbox spans [y, y+2.0]; at jump apex y=2.0, so the
//   airborne box is [2.0, 4.0] -- clears BARRICADE_LOW's 1.0 top, but
//   still overlaps DRONE_HIGH's 2.6 top (2.0 < 2.6).
//   SLIDING hitbox spans [y, y+0.9] -- clears DRONE_LOW's 1.1 bottom, but
//   still overlaps everything else's 0-height-start obstacles.
// If either table is ever retuned, retune both together and re-run the
// cross-check in the Milestone 5 verification script.
// -----------------------------------------------------------------------
export const OBSTACLE_TYPES = {
  BARRICADE_LOW: { laneSpan: 1, heightMin: 0.0, heightMax: 1.0, escape: "jump" },
  BARRICADE_WIDE: { laneSpan: 2, heightMin: 0.0, heightMax: 2.6, escape: "switch" },
  DRONE_LOW: { laneSpan: 1, heightMin: 1.1, heightMax: 3.0, escape: "slide" },
  DRONE_HIGH: { laneSpan: 1, heightMin: 0.35, heightMax: 2.6, escape: "switch" },
};

// -----------------------------------------------------------------------
// Difficulty ramp. Per-level BASE speed (1.0x/1.3x/1.6x) already lives in
// GameContent.js's levels array -- this is the ADDITIONAL, smooth ramp
// that happens WITHIN a level as the player travels through it, capped so
// the level never outpaces what SpawnDirector can guarantee is solvable.
// Ramps by DISTANCE TRAVELED since the level started, not wall-clock time
// -- a slower player takes longer in real seconds but experiences the same
// ramp over the same ground covered, which is the more meaningful
// "progress" metric for a runner.
// -----------------------------------------------------------------------
export const DIFFICULTY_RAMP = {
  speedRampMultiplier: 1.25, // in-level speed ramps toward levelBaseSpeed * this
  densityRampMultiplier: 1.4, // obstacle density (patterns/chunk) ramps toward this factor
  rampDistance: 1800, // world units of travel for the ramp to fully complete (~60s at level-1 base speed)
};

// Reference point the fairness scaling below is calibrated against:
// FRAMING.lookAheadZ (45) was chosen so that at this base speed,
// reactionTime = 45/30 = 1.5s. As speed increases -- from a higher-level
// base multiplier OR the intra-level ramp above -- lookAheadZ and pattern
// spacing scale UP proportionally so reactionTime in SECONDS stays 1.5s
// regardless of why the world got faster. This is a difficulty-axis
// fairness guarantee, distinct from (and in addition to) Milestone 2's
// device-axis one -- neither camera framing nor per-device speed changes,
// only SpawnDirector's placement math reads this.
export const REACTION_BASE_SPEED = 30;

// Minimum time between distinct obstacle "events" within a single pattern,
// so a multi-obstacle combo is never packed tighter than this once
// converted to a world-unit gap via the CURRENT speed. Deliberately modest
// (not a full lookAheadZ-scale window): the plan's actual "minimum
// reaction distance" guarantee is about where a pattern is FIRST
// INSTANTIATED (structurally ~270 units from the player in this
// chunk-recycle architecture -- see SpawnDirector.js), not about spacing
// between obstacles a player already sees coming as part of one
// authored sequence. This value exists so SpawnDirector can filter out a
// tightly-spaced combo pattern (e.g. two obstacles 6 units apart) once
// speed climbs high enough that 6 units stops being a fair gap, falling
// back to simpler/solo patterns -- a difficulty-adaptive safety valve, not
// a hard per-obstacle-pair requirement most reference runners use anyway.
export const MIN_OBSTACLE_GAP_SECONDS = 0.15;

// A pattern can't be selected again until this many chunk-spawns have
// passed, so the same shape doesn't repeat back-to-back.
export const PATTERN_NO_REPEAT_WINDOW = 4;

// -----------------------------------------------------------------------
// Coin economy and power-ups (Milestone 6). Fixes the unwinnable level:
// each level's feature list is dealt as a shuffled bag WITHOUT replacement
// (every unique feature is guaranteed to appear within any window of
// levelData.features.length draws -- unlike independent random-with-
// replacement sampling, which is what forced the original ~81-collects
// coupon-collector problem for a 22-feature level). The bag reshuffles and
// refills automatically once emptied, so missing a coin is never a
// permanent loss -- the same feature comes back around later in the run,
// which is what actually guarantees the level stays completable regardless
// of player skill, rather than a hard distance/time cap that could stand
// up a slower player with no way to finish.
// -----------------------------------------------------------------------

// Height for a coin that rewards clearing a BARRICADE_LOW by jumping --
// matches PLAYER_PHYSICS's jump apex (2.0) so the coin trail visually
// traces the jump arc and sits where the player's airborne hitbox actually
// reaches, not the default running-height (1.2) the airborne hitbox climbs
// well above mid-jump.
export const COIN_JUMP_REWARD_HEIGHT = 2.0;

// Power-ups: both map onto real ChargeOn features already in Level 2's
// feature list (GameContent.js) -- collecting that specific feature coin
// IS the power-up pickup, so the marketing message and the mechanic are
// the same event. Keyed by the EXACT feature name.
export const POWER_UPS = {
  "Automated Collection": { type: "magnet", durationMs: 8000 },
  "Payment Gateway Fallback Mechanism": { type: "shield" },
};

// Magnet pickup half-width: reuses FRAMING.laneSpanX (already "3 lanes + a
// 1-unit margin each side" from Milestone 2) so an active magnet
// auto-collects any coin that reaches the collision z-band regardless of
// which lane it's actually in.
export const MAGNET_HALF_WIDTH = FRAMING.laneSpanX / 2;

export const SCORE_POINTS = {
  coin: 100,
  exclusiveBonus: 50,
};

// Minimum world-distance between two NEW features being dealt from the
// bag. Without this, WorldStreamer's dense per-recycle coin-slot
// population (up to 3 slots, most chunks, every ~0.667s at level-1 speed)
// deals all 22 of a level's features within the first ~15s of a run --
// technically winnable (the bag fix already guarantees that) but far
// short of the plan's ~60-75s-per-level pacing target. Spacing new
// features roughly every 90 units means a 2000-unit level-1 run (the
// plan's own estimate) deals all 22 required features across the full
// run instead of the first tenth of it. Verified empirically in the
// Milestone 6 simulation, not just derived on paper -- see
// docs/PROCESS_TRACKER.md.
export const FEATURE_SPACING_DISTANCE = 90;
