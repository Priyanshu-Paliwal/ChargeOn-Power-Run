import * as THREE from "three";
import { characterLoader } from "./CharacterLoader.js";
import {
  PLAYER_PHYSICS,
  PLAYER_HITBOX,
  SLIDE_DURATION_MS,
  SLIDE_RECOVERY_MS,
  HIT_REACTION_MS,
  HIT_STUMBLE_MS,
  HIT_INVULNERABILITY_MS,
  CHARACTERS,
  JETPACK_MODEL_URL,
  JETPACK_FLIGHT_HEIGHT,
  HOVERBOARDS,
  getHoverboardConfig,
  DEFAULT_HOVERBOARD_ID,
  BOARD_DURATION_MS,
  BOARD_COOLDOWN_MS,
} from "../config/GameConfig.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

export const PlayerMovementState = {
  RUNNING: "RUNNING",
  JUMPING: "JUMPING",
  SLIDING: "SLIDING",
  JETPACK: "JETPACK",
};

const _hitboxCenter = new THREE.Vector3();
const _hitboxSize = new THREE.Vector3();

// Movement + explicit state machine + state-driven hitbox. Consumes an
// InputManager (keyboard/touch/buffering) rather than owning its own
// listeners, so input handling isn't tangled with physics.
//
// `isHit` is a separate overlay flag, NOT a 4th state alongside
// RUNNING/JUMPING/SLIDING -- taking a blocker hit locks new input and
// flashes the model red, but doesn't interrupt an in-progress jump or
// slide (matches the original's actual behaviour: takeHit() never touched
// isJumping/isSliding). Only RUNNING/JUMPING/SLIDING drive the hitbox.
export class Player {
  constructor(scene, inputManager) {
    this.scene = scene;
    this.inputManager = inputManager;

    this.mesh = new THREE.Group();
    this.mesh.position.set(0, 0, 0);
    this.scene.add(this.mesh);

    // Temporary glowing placeholder while the asset loads
    const placeholderGeo = new THREE.CapsuleGeometry(0.5, 1, 4, 16);
    const placeholderMat = new THREE.MeshStandardMaterial({
      color: 0x00b0ff,
      emissive: 0x00b0ff,
      emissiveIntensity: 0.5,
      wireframe: true,
    });
    this.model = new THREE.Mesh(placeholderGeo, placeholderMat);
    this.model.position.y = 1;
    this.mesh.add(this.model);
    this._isPlaceholder = true;

    // Animation Setup
    this.mixer = null;
    this.animations = {};
    this.currentAction = null;
    this.currentActionName = "Idle";
    this._activeSequence = null;
    this._sequenceLoop = true;
    this._sequenceIndex = 0;
    this._sequenceFinishedHandler = null;
    this.characterId = CHARACTERS[0].id;
    this._loadToken = 0;
    // Which way the model should face (0 = toward camera, Math.PI = down track).
    this._facingY = 0;

    // Load the selected character (Milestone 7: CharacterLoader replaces the
    // old single hardcoded Soldier.glb load). Engine.js kicks off
    // characterLoader.prefetchAll() independently, so by the time a visitor
    // actually picks a character on the Lobby screen this has usually
    // already resolved from cache.
    this._loadCharacterModel(this.characterId);

    // Lane logic (never blocked by movement state -- lateral movement is
    // independent of jump/slide, matching the original).
    this.lanes = PLAYER_PHYSICS.lanes;
    this.currentLane = 1;
    this.targetX = this.lanes[this.currentLane];

    // Movement state machine
    this.movementState = PlayerMovementState.RUNNING;
    this.baseY = 0;
    this._jumpElapsed = 0;
    this._jumpAirtime =
      (2 * PLAYER_PHYSICS.jumpForce) / Math.abs(PLAYER_PHYSICS.gravity);
    this._slideTimer = 0;
    this._slideCooldown = 0;

    // Hit-reaction overlay & invulnerability grace period
    this.lives = 3;
    this.isHit = false;
    this._hitTimer = 0;
    this._invulnerableTimer = 0;

    // Power-ups (Milestone 6). Both are themed to real ChargeOn features
    // (see GameConfig.js's POWER_UPS) -- collecting that specific feature
    // coin activates the buff as a side effect of normal collection credit,
    // wired from CollisionSystem/Engine.js, not from anything in here.
    this.hasMagnet = false;
    this._magnetTimer = 0;
    this._magnetDurationMs = 0; // total duration of the CURRENT activation, for getPowerUpStatus()'s remaining/total ratio
    this.hasShield = false;

    // Simple always-present aura meshes (hidden when inactive, so zero
    // draw-call cost at rest, matching every other pooled-and-hidden
    // pattern in this codebase) -- give the player SOME visual signal that
    // a buff is active now, ahead of Milestone 8's proper HUD icon/timer.
    const shieldGeo = new THREE.SphereGeometry(1.3, 16, 12);
    const shieldMat = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.3,
      emissive: 0x00e5ff,
      emissiveIntensity: 0.6,
      depthWrite: false,
    });
    this.shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    this.shieldMesh.position.y = 1.0;
    this.shieldMesh.visible = false;
    this.mesh.add(this.shieldMesh);

    const magnetGeo = new THREE.TorusGeometry(1.6, 0.06, 8, 24);
    const magnetMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      transparent: true,
      opacity: 0.5,
      emissive: 0xffd700,
      emissiveIntensity: 0.8,
      depthWrite: false,
    });
    this.magnetMesh = new THREE.Mesh(magnetGeo, magnetMat);
    this.magnetMesh.position.y = 0.15;
    this.magnetMesh.rotation.x = Math.PI / 2;
    this.magnetMesh.visible = false;
    this.mesh.add(this.magnetMesh);

    // Jetpack setup
    this.hasJetpack = false;
    this._jetpackTimer = 0;
    this._jetpackDurationMs = 0;
    this.jetpackMesh = new THREE.Group();
    this.jetpackMesh.visible = false;
    // We attach jetpackMesh to the mesh. Since the character flies horizontally,
    // we rotate the jetpack to lie flat against their back and adjust the height.
    this.jetpackMesh.position.set(0, 1.5, 0); // back position for horizontal flight
    this.jetpackMesh.rotation.x = -Math.PI / 2; // lie flat
    this.mesh.add(this.jetpackMesh);

    const loader = new GLTFLoader();
    loader.load(JETPACK_MODEL_URL, (gltf) => {
      const jp = gltf.scene;
      // Adjust scale and rotation if necessary
      jp.scale.set(0.14, 0.14, 0.14);
      jp.rotation.y = Math.PI / 2; // Face backwards

      // Add a bluish glowing PointLight for the active jetpack effect
      const jetpackLight = new THREE.PointLight(0x00aaff, 3, 5);

      jp.traverse((child) => {
        // 'Nucleo' is the white circle core on the back
        if (child.name === "Nucleo") {
          child.add(jetpackLight);
        }

        // Ensure the core material itself is highly emissive
        if (child.isMesh && child.material) {
          const materials = Array.isArray(child.material)
            ? child.material
            : [child.material];
          materials.forEach((mat) => {
            if (mat.name === "Material.003") {
              mat.emissive = new THREE.Color(0x00aaff);
              mat.emissiveIntensity = 2.0; // Boost glow intensity
            }
          });
        }
      });

      this.jetpackMesh.add(jp);
    });

    // Board (Skateboard / Surfboard / Multi-Hoverboard) setup
    this.hasBoard = false;
    this._isBoardPreview = false;
    this._boardTimer = 0;
    this._boardDurationMs = 0;
    this._boardCooldown = 0;
    this.boardMesh = new THREE.Group();
    this.boardMesh.visible = false;
    this.mesh.add(this.boardMesh);

    this.currentHoverboardId = DEFAULT_HOVERBOARD_ID;
    this._hoverboardCache = new Map();
    this._currentBoardModelNode = null;

    // Subtle colored under-glow light for the board
    this.boardLight = new THREE.PointLight(0x00e5ff, 2.5, 4);
    this.boardLight.position.set(0, 0.12, 0);
    this.boardMesh.add(this.boardLight);

    const boardDraco = new DRACOLoader();
    boardDraco.setDecoderPath("/draco/");
    this._boardGltfLoader = new GLTFLoader();
    this._boardGltfLoader.setDRACOLoader(boardDraco);

    // Initial load and background preloading of all hoverboards
    this.setHoverboard(this.currentHoverboardId);
    this.prefetchAllHoverboards();
  }

  // durationMs comes from GameConfig.js's POWER_UPS (via the coin's
  // userData, forwarded through CollisionSystem's onHit payload) --
  // re-collecting the same power-up REFRESHES rather than stacks, so two
  // quick pickups don't silently grant double duration.
  activateMagnet(durationMs) {
    this.hasMagnet = true;
    this._magnetTimer = durationMs;
    this._magnetDurationMs = durationMs;
  }

  activateShield() {
    this.hasShield = true;
  }

  activateJetpack(durationMs) {
    if (this.movementState === PlayerMovementState.JETPACK) {
      this._jetpackTimer = durationMs;
      this._jetpackDurationMs = durationMs;
      return;
    }
    this.hasJetpack = true;
    this._jetpackTimer = durationMs;
    this._jetpackDurationMs = durationMs;
    this.movementState = PlayerMovementState.JETPACK;
    this.jetpackMesh.visible = true;

    // Hoverboard must NOT fly in the sky with jetpack
    this.boardMesh.visible = false;

    // Play the flying animation
    this.setAnimation("Flying");
  }

  setHoverboard(boardId, preview = null) {
    const cfg = getHoverboardConfig(boardId);
    this.currentHoverboardId = cfg.id;

    if (this.boardLight) {
      this.boardLight.color.setHex(cfg.glowColor || 0x00e5ff);
    }

    if (preview !== null) {
      this._isBoardPreview = Boolean(preview);
    }

    const showBoard = !this.hasJetpack && (this.hasBoard || this._isBoardPreview);
    this.boardMesh.visible = showBoard;
    if (!showBoard && this.model && !this.hasBoard) {
      this.model.position.y = 0;
    }

    if (this._hoverboardCache.has(cfg.id)) {
      const cached = this._hoverboardCache.get(cfg.id);
      this._mountBoardGroup(cached);
      return;
    }

    this._loadBoardModel(cfg, (grp) => {
      if (this.currentHoverboardId === cfg.id) {
        this._mountBoardGroup(grp);
      }
    });
  }

  _loadBoardModel(cfg, onLoaded) {
    this._boardGltfLoader.load(
      cfg.url,
      (gltf) => {
        const rawModel = gltf.scene;

        // Auto-center raw model bounds to (0,0,0) so pivot is centered
        const box = new THREE.Box3().setFromObject(rawModel);
        const center = new THREE.Vector3();
        box.getCenter(center);
        rawModel.position.sub(center);

        // Container with calibrated transforms
        const group = new THREE.Group();
        group.add(rawModel);
        group.scale.set(cfg.scale, cfg.scale, cfg.scale);
        group.rotation.set(cfg.rotation[0], cfg.rotation[1], cfg.rotation[2]);

        // Auto-align: calculate transformed bounds so bottom surface sits precisely at local y = 0
        group.updateMatrixWorld(true);
        const transformedBox = new THREE.Box3().setFromObject(group);
        const minY = transformedBox.min.y;
        const maxY = transformedBox.max.y;
        const totalThickness = maxY - minY;

        // Shift model so its bottom-most point is always anchored at y = 0
        group.position.y = -minY;

        // Store deckThickness and footOffset on the group for player elevation
        group.userData.deckThickness =
          cfg.deckThickness !== undefined ? cfg.deckThickness : totalThickness;
        group.userData.footOffset =
          cfg.footOffset !== undefined ? cfg.footOffset : 0;

        rawModel.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        this._hoverboardCache.set(cfg.id, group);
        if (onLoaded) onLoaded(group);
      },
      undefined,
      (err) => console.warn(`Failed to load hoverboard ${cfg.id}:`, err),
    );
  }

  _mountBoardGroup(group) {
    if (
      this._currentBoardModelNode &&
      this._currentBoardModelNode.parent === this.boardMesh
    ) {
      this.boardMesh.remove(this._currentBoardModelNode);
    }
    this._currentBoardModelNode = group;
    this.boardMesh.add(group);

    // Immediately update feet elevation for the newly mounted board
    const showBoard =
      (this.hasBoard || this._isBoardPreview) && !this.hasJetpack;
    if (
      showBoard &&
      this.model &&
      this.movementState === PlayerMovementState.RUNNING
    ) {
      const deckThickness = group.userData.deckThickness ?? 0.08;
      const footOffset = group.userData.footOffset ?? 0;
      this.model.position.y =
        this.boardMesh.position.y + deckThickness + footOffset;
    } else if (this.model && !this.hasBoard) {
      this.model.position.y = 0;
    }
  }

  prefetchAllHoverboards() {
    HOVERBOARDS.forEach((b) => {
      if (!this._hoverboardCache.has(b.id)) {
        this._loadBoardModel(b);
      }
    });
  }

  cycleHoverboard() {
    const pool = HOVERBOARDS.filter((b) => b.id !== this.currentHoverboardId);
    const randomBoard =
      pool.length > 0
        ? pool[Math.floor(Math.random() * pool.length)]
        : HOVERBOARDS[0];
    this.setHoverboard(randomBoard.id, false);
    return randomBoard;
  }

  setBoardPreview(active) {
    this._isBoardPreview = Boolean(active);
    const showBoard = !this.hasJetpack && (this.hasBoard || this._isBoardPreview);
    this.boardMesh.visible = showBoard;
    if (!showBoard && this.model && !this.hasBoard) {
      this.model.position.y = 0;
    }
  }

  activateBoard(durationMs = BOARD_DURATION_MS) {
    if (this._boardCooldown > 0) return false;

    // Pick a random hoverboard each time user activates the hoverboard
    const pool = HOVERBOARDS.filter((b) => b.id !== this.currentHoverboardId);
    const randomBoard =
      pool.length > 0
        ? pool[Math.floor(Math.random() * pool.length)]
        : HOVERBOARDS[Math.floor(Math.random() * HOVERBOARDS.length)];
    this.setHoverboard(randomBoard.id, false);

    this.hasBoard = true;
    this._boardTimer = durationMs;
    this._boardDurationMs = durationMs;
    this.boardMesh.visible = !this.hasJetpack;
    if (
      this.movementState === PlayerMovementState.RUNNING &&
      !this.hasJetpack
    ) {
      this.setAnimation("Surfing");
    }
    return true;
  }

  _endBoard() {
    this.hasBoard = false;
    this.boardMesh.visible = false;
    this._isBoardPreview = false;
    this._boardTimer = 0;
    this._boardCooldown = BOARD_COOLDOWN_MS;
    this.boardMesh.position.set(0, 0, 0);
    this.boardMesh.rotation.set(0, 0, 0);
    if (this.model) {
      this.model.position.y = 0;
    }
    if (
      this.movementState === PlayerMovementState.RUNNING &&
      !this.hasJetpack
    ) {
      this.setAnimation("Run");
    }
  }

  // Small public read-only getter (Milestone 8's HUD radial timer) so the
  // Vue layer polls this instead of reaching for underscore-prefixed
  // "private" fields directly. Shield has no remaining/duration pair --
  // it's a one-hit absorb, not a countdown -- so the HUD only ever shows a
  // static icon for it, never a ring.
  getPowerUpStatus() {
    return {
      magnetActive: this.hasMagnet,
      magnetRemainingMs: this._magnetTimer,
      magnetDurationMs: this._magnetDurationMs,
      shieldActive: this.hasShield,
      jetpackActive: this.hasJetpack,
      jetpackRemainingMs: this._jetpackTimer,
      jetpackDurationMs: this._jetpackDurationMs,
      boardActive: this.hasBoard,
      boardRemainingMs: this._boardTimer,
      boardDurationMs: this._boardDurationMs,
      currentHoverboardId: this.currentHoverboardId,
    };
  }

  update(delta, enabled) {
    if (this.mixer) this.mixer.update(delta);

    // Resolve state-timer transitions BEFORE processing input, so a
    // slide/jump that ends THIS frame lets a buffered action fire the same
    // frame it clears -- not one frame later, which would needlessly eat
    // into the input buffer's window.
    if (this.movementState === PlayerMovementState.JUMPING) {
      // Analytic (closed-form) position, not step-by-step Euler
      // integration: y(t) = v0*t + 0.5*g*t^2. Euler stepping
      // (yVelocity += g*dt; y += yVelocity*dt) systematically undershoots
      // the true apex, and the error SCALES with frame time -- measured
      // ~5% low at a real 60fps and ~15% low at 20fps, meaning a struggling
      // phone would give players a shorter, weaker jump than a smooth
      // device for the exact same button press. The analytic formula gives
      // the exact same apex (2.0, by design) regardless of framerate.
      this._jumpElapsed += delta;
      if (this._jumpElapsed >= this._jumpAirtime) {
        this.mesh.position.y = this.baseY;
        this.movementState = PlayerMovementState.RUNNING;
        this._jumpElapsed = 0;
        this.setAnimation(this.hasBoard ? "Surfing" : "Run");
      } else {
        this.mesh.position.y =
          this.baseY +
          PLAYER_PHYSICS.jumpForce * this._jumpElapsed +
          0.5 * PLAYER_PHYSICS.gravity * this._jumpElapsed * this._jumpElapsed;
      }
    } else if (this.movementState === PlayerMovementState.SLIDING) {
      this._slideTimer -= delta * 1000;
      if (this._slideTimer <= 0) {
        this._endSlide();
      }
    } else if (this.movementState === PlayerMovementState.JETPACK) {
      this._jetpackTimer -= delta * 1000;

      const takeoffTime = 500;
      const landingTime = 500;
      const elapsed = this._jetpackDurationMs - this._jetpackTimer;

      let targetY = this.baseY;
      if (elapsed < takeoffTime) {
        // Smooth takeoff
        const t = elapsed / takeoffTime;
        // Ease out quad
        const ease = t * (2 - t);
        targetY = this.baseY + (JETPACK_FLIGHT_HEIGHT - this.baseY) * ease;
      } else if (this._jetpackTimer < landingTime) {
        // Smooth landing
        const t = this._jetpackTimer / landingTime;
        // Ease in out
        const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        targetY = this.baseY + (JETPACK_FLIGHT_HEIGHT - this.baseY) * ease;
      } else {
        targetY = JETPACK_FLIGHT_HEIGHT;
      }

      this.mesh.position.y = targetY;

      if (this._jetpackTimer <= 0) {
        this._endJetpack();
      }
    }

    if (this._slideCooldown > 0) {
      this._slideCooldown -= delta * 1000;
    }

    if (this._invulnerableTimer > 0) {
      this._invulnerableTimer -= delta * 1000;
    }

    if (this.inputManager) {
      this.inputManager.prune();
      if (enabled) {
        this._processInput();
      }
    }

    if (this.isHit) {
      this._hitTimer -= delta * 1000;
      if (this._hitTimer <= 0) {
        this._cancelHitReaction();
        // Stumble clip finished or expired naturally -- recover smoothly back to Run/Surfing if not in a sequence
        if (this.movementState === PlayerMovementState.RUNNING && !this._activeSequence) {
          this.setAnimation(this.hasBoard ? "Surfing" : "Run");
        }
      }
    }

    if (this.hasMagnet) {
      this._magnetTimer -= delta * 1000;
      if (this._magnetTimer <= 0) {
        this.hasMagnet = false;
        this._magnetTimer = 0;
      }
    }
    this.magnetMesh.visible = this.hasMagnet;
    if (this.hasMagnet) this.magnetMesh.rotation.z += delta * 2;
    this.shieldMesh.visible = this.hasShield;

    // Board cooldown & update
    if (this._boardCooldown > 0) {
      this._boardCooldown -= delta * 1000;
    }

    // Only tick down board timer if NOT flying on jetpack
    if (this.hasBoard && !this.hasJetpack) {
      this._boardTimer -= delta * 1000;
      if (this._boardTimer <= 0) {
        this._endBoard();
      }
    }

    const showBoard =
      (this.hasBoard || this._isBoardPreview) && !this.hasJetpack;
    if (showBoard) {
      // Subway Surfers-style gentle hover bobbing
      const bobbing = Math.sin(performance.now() * 0.008) * 0.022;
      const bottomClearance = this.hasBoard ? 0.08 : 0.05;
      const boardBottomY = bottomClearance + bobbing;
      this.boardMesh.position.y = boardBottomY;

      // Keep character feet synchronized with board deck
      const deckThickness =
        this._currentBoardModelNode?.userData?.deckThickness ?? 0.08;
      const footOffset = this._currentBoardModelNode?.userData?.footOffset ?? 0;
      if (this.model && this.movementState === PlayerMovementState.RUNNING) {
        this.model.position.y = boardBottomY + deckThickness + footOffset;
      }

      if (this.hasBoard) {
        // Dynamic banking roll when turning/changing lanes
        const lateralOffset = this.mesh.position.x - this.targetX;
        this.boardMesh.rotation.z = lateralOffset * -0.28;
        this.boardMesh.rotation.y = lateralOffset * -0.18;
      } else {
        this.boardMesh.rotation.set(0, 0, 0);
      }
    } else {
      this.boardMesh.position.set(0, 0, 0);
      this.boardMesh.rotation.set(0, 0, 0);
      if (this.model && this.movementState === PlayerMovementState.RUNNING) {
        this.model.position.y = 0;
      }
    }
    this.boardMesh.visible = showBoard;

    // Smooth Lane Transitioning (Framerate independent to prevent shaking/overshooting on lag)
    const lerpFactor = 1.0 - Math.exp(-PLAYER_PHYSICS.laneSwitchSpeed * delta);
    this.mesh.position.x += (this.targetX - this.mesh.position.x) * lerpFactor;

    // Banking effect
    this.mesh.rotation.z = (this.mesh.position.x - this.targetX) * -0.1;
    this.mesh.rotation.y = (this.mesh.position.x - this.targetX) * -0.15;
  }

  _cancelHitReaction() {
    if (!this.isHit) return;
    this.isHit = false;
    this._hitTimer = 0;
    this._clearHitFlash();
  }

  _processInput() {
    // Board activation input (double-tap or 'B' key or on-screen button)
    if (this.inputManager.consumeBuffered("board")) {
      if (!this.hasBoard && this._boardCooldown <= 0) {
        if (this.isHit) this._cancelHitReaction();
        this.activateBoard();
      }
    }

    // Quick hoverboard cycle input ('H' key or on-screen switcher)
    if (this.inputManager.consumeBuffered("cycle_board")) {
      if (this.isHit) this._cancelHitReaction();
      this.cycleHoverboard();
    }

    const laneReqs = this.inputManager.consumeLaneRequests();
    for (const dir of laneReqs) {
      if (dir < 0 && this.currentLane > 0) this.currentLane--;
      else if (dir > 0 && this.currentLane < 2) this.currentLane++;
    }
    if (laneReqs.length > 0) {
      this.targetX = this.lanes[this.currentLane];
      // Responsive cancel: swiping or pressing lane switch immediately interrupts stumble
      if (this.isHit) {
        this._cancelHitReaction();
        if (this.movementState === PlayerMovementState.RUNNING) {
          this.setAnimation(this.hasBoard ? "Surfing" : "Run");
        }
      }
    }

    // Jump and Slide input handling with animation cancelling (Subway Surfers style)
    if (this.inputManager.consumeBuffered("jump")) {
      if (this.isHit) {
        // Immediate override: cancel stumble into jump
        this._cancelHitReaction();
        if (this.movementState !== PlayerMovementState.JUMPING) {
          this._startJump();
        }
      } else if (
        (this.movementState === PlayerMovementState.RUNNING &&
          this._slideCooldown <= 0) ||
        this.movementState === PlayerMovementState.SLIDING
      ) {
        // Jump normally, or cancel a slide into a jump
        this._startJump();
      }
    } else if (this.inputManager.consumeBuffered("slide")) {
      if (this.isHit) {
        // Immediate override: cancel stumble into slide
        this._cancelHitReaction();
        if (this.movementState === PlayerMovementState.JUMPING) {
          // Quick drop: Cancel jump and slam to the ground instantly
          this.mesh.position.y = this.baseY;
        }
        this._startSlide();
      } else if (
        (this.movementState === PlayerMovementState.RUNNING &&
          this._slideCooldown <= 0) ||
        this.movementState === PlayerMovementState.JUMPING
      ) {
        if (this.movementState === PlayerMovementState.JUMPING) {
          // Quick drop: Cancel jump and slam to the ground instantly
          this.mesh.position.y = this.baseY;
        }
        this._startSlide();
      }
    }
  }

  _startJump() {
    this.movementState = PlayerMovementState.JUMPING;
    this._jumpElapsed = 0;

    // Real Jump clip now that every character carries one (Milestone 7) --
    // replaces the old "pause Run mid-cycle" fake-airborne-pose hack that
    // Soldier.glb's lack of a jump clip forced. setDuration() stretches the
    // clip's authored 0.6s to whatever _jumpAirtime actually is, so the
    // animation always matches PLAYER_PHYSICS even if jumpForce/gravity are
    // retuned later.
    const jumpAction = this.animations["Jump"];
    if (jumpAction) jumpAction.setDuration(this._jumpAirtime);
    this._playOneShot("Jump");
  }

  _startSlide() {
    this.movementState = PlayerMovementState.SLIDING;
    this._slideTimer = SLIDE_DURATION_MS;

    // Real Slide clip now that every character carries one (Milestone 7) --
    // replaces the old hack of rotating/translating the whole model
    // transform directly, which existed only because there was no slide
    // animation to play instead.
    const slideAction = this.animations["Slide"];
    if (slideAction) slideAction.setDuration(SLIDE_DURATION_MS / 1000);
    this._playOneShot("Slide");
  }

  _endSlide() {
    this.movementState = PlayerMovementState.RUNNING;
    this._slideCooldown = SLIDE_RECOVERY_MS;
    this.setAnimation(this.hasBoard ? "Surfing" : "Run");
  }

  _endJetpack() {
    this.hasJetpack = false;
    this.jetpackMesh.visible = false;
    this.mesh.position.y = this.baseY;
    this.movementState = PlayerMovementState.RUNNING;
    this.boardMesh.visible =
      !this.hasJetpack && (this.hasBoard || this._isBoardPreview);
    this.setAnimation(this.hasBoard ? "Surfing" : "Run");
    if (this.onJetpackEnd) this.onJetpackEnd();
  }

  // Fills `target` (a reused THREE.Box3, avoiding per-call allocation) with
  // the hitbox for the CURRENT movement state and returns it. RUNNING and
  // JUMPING share the same height -- "raised by jump arc" falls out
  // naturally from mesh.position.y already being higher mid-jump, not from
  // a separate jumping-specific size. Only SLIDING is a distinct, short box.
  writeHitboxBox3(target) {
    const height =
      this.movementState === PlayerMovementState.SLIDING
        ? PLAYER_HITBOX.slidingHeight
        : PLAYER_HITBOX.runningHeight;
    const pPos = this.mesh.position;
    _hitboxCenter.set(pPos.x, pPos.y + height / 2, pPos.z);
    _hitboxSize.set(PLAYER_HITBOX.width, height, PLAYER_HITBOX.depth);
    return target.setFromCenterAndSize(_hitboxCenter, _hitboxSize);
  }

  // Returns whether the hit actually cost a life (false if the shield
  // absorbed it, or if already in the hit-reaction lock). CollisionSystem
  // uses this to decide whether to report the outcome as "blocker" (real
  // damage) or "shielded" (absorbed) -- App.vue's authoritative life
  // counter and game-over check depend on knowing which happened.
  takeHit() {
    // Damage invulnerability: prevents unfair back-to-back damage
    if (this._invulnerableTimer > 0) return false;

    if (this.hasShield) {
      this.hasShield = false;
      this._invulnerableTimer = 500; // brief grace period after shield breaks
      return false; // absorbed -- no life lost, no hit-reaction lock/flash
    }

    // Subway Surfers Board Crash Mechanic: board absorbs the collision, saving the player!
    if (this.hasBoard) {
      this._endBoard();
      this.isHit = true;
      this._hitTimer = HIT_STUMBLE_MS;
      this._invulnerableTimer = HIT_INVULNERABILITY_MS;
      this._playOneShot("Stumble");
      if (this.model) {
        this.model.traverse((child) => {
          if (child.isMesh && child.material) {
            child.material.emissive.setHex(0x00e5ff);
            child.material.emissiveIntensity = 2;
          }
        });
      }
      return "board_saved";
    }

    this.isHit = true;
    this.lives--;
    this._hitTimer = HIT_STUMBLE_MS;
    this._invulnerableTimer = HIT_INVULNERABILITY_MS;

    // Real Stumble clip now that every character carries one (Milestone 7
    // authored it; Milestone 9 is what actually wires it in, as flagged in
    // docs/PROCESS_TRACKER.md's M7 notes). Fires regardless of
    // movementState -- isHit is a pure overlay, independent of
    // RUNNING/JUMPING/SLIDING by design (see this class's header comment),
    // so a hit taken mid-jump still gets a stumble reaction layered on top.
    this._playOneShot("Stumble");

    if (this.model) {
      this.model.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.emissive.setHex(0xff0000);
          child.material.emissiveIntensity = 2;
        }
      });
    }
    return true;
  }

  _clearHitFlash() {
    if (!this.model) return;
    this.model.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.emissive.setHex(0x000000);
        child.material.emissiveIntensity = 0;
      }
    });
  }

  setAnimation(animName) {
    this.stopSequence();
    if (!this.mixer || !this.animations[animName]) return;
    const newAction = this.animations[animName];
    const currentAction = this.animations[this.currentActionName];

    if (newAction === currentAction) return;

    if (currentAction) {
      newAction.reset();
      newAction.play();
      const isLoopTransition =
        (this.currentActionName === "Idle" && animName === "Run") ||
        (this.currentActionName === "Run" && animName === "Idle") ||
        (this.currentActionName === "Surfing" && animName === "Run") ||
        (this.currentActionName === "Run" && animName === "Surfing");
      newAction.crossFadeFrom(currentAction, isLoopTransition ? 0.3 : 0.15, isLoopTransition);
    } else {
      newAction.play();
    }

    newAction.paused = false;
    this.currentActionName = animName;
    this.currentAction = newAction;
  }

  // Plays an array of animations in sequence (e.g. Victory_idle -> victory_jump -> Victory_idle ...)
  playSequence(animNames, loop = true) {
    if (!animNames || animNames.length === 0) return;
    this.stopSequence();

    this._activeSequence = [...animNames];
    this._sequenceLoop = loop;
    this._sequenceIndex = 0;

    if (!this.mixer) return;

    const playNext = (index) => {
      if (!this._activeSequence || this._activeSequence.length === 0) return;
      const name = this._activeSequence[index];
      const action = this.animations[name];
      if (!action) {
        console.warn(`[Player] playSequence: animation "${name}" not found in animations library`);
        return;
      }

      const previous = this.currentAction;
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.reset();

      if (previous && previous !== action) {
        action.play();
        action.crossFadeFrom(previous, 0.25, false);
      } else {
        action.play();
      }

      action.paused = false;
      this.currentActionName = name;
      this.currentAction = action;
    };

    this._sequenceFinishedHandler = (e) => {
      if (!this._activeSequence) return;
      const currentName = this._activeSequence[this._sequenceIndex];
      const currentAction = this.animations[currentName];
      if (e.action === currentAction) {
        let nextIndex = this._sequenceIndex + 1;
        if (nextIndex >= this._activeSequence.length) {
          if (this._sequenceLoop) {
            nextIndex = 0;
          } else {
            return;
          }
        }
        this._sequenceIndex = nextIndex;
        playNext(nextIndex);
      }
    };

    this.mixer.addEventListener("finished", this._sequenceFinishedHandler);
    playNext(0);
  }

  stopSequence() {
    if (this._sequenceFinishedHandler && this.mixer) {
      this.mixer.removeEventListener("finished", this._sequenceFinishedHandler);
      this._sequenceFinishedHandler = null;
    }
    this._activeSequence = null;
  }

  _playOneShot(name) {
    this.stopSequence();
    const action = this.animations[name];
    if (!action) return;
    const previous = this.currentAction;
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.reset().fadeIn(0.1).play();
    if (previous && previous !== action) previous.fadeOut(0.1);
    this.currentActionName = name;
    this.currentAction = action;
  }

  // Owns the facing rotation instead of letting Engine.js poke
  // `model.rotation.y` directly -- `this.model` gets replaced wholesale on
  // every character swap, so anything written straight onto the old model
  // would silently vanish the next time setCharacter() resolves. Storing it
  // here means it's automatically reapplied in _loadCharacterModel().
  setFacing(rotationY) {
    this._facingY = rotationY;
    if (this.model) {
      const def = CHARACTERS.find((c) => c.id === this.characterId);
      const offset = def && def.rotationOffset ? def.rotationOffset : 0;
      this.model.rotation.y = rotationY + offset;
    }
  }

  // Swaps the visible character model (id from GameConfig.js's CHARACTERS).
  // Safe to call at any time, including mid-Lobby-orbit while the previous
  // model is still loaded -- CharacterLoader's cache means every character
  // after the first is normally already resolved by the time this runs.
  setCharacter(id) {
    if (id === this.characterId && this.model && !this._isPlaceholder) return;
    this.characterId = id;
    this._loadCharacterModel(id);
  }

  async _loadCharacterModel(id) {
    const requestId = ++this._loadToken;
    const [gltf, clips] = await Promise.all([
      characterLoader.loadCharacter(id),
      characterLoader.loadAnimations(),
    ]);

    // Another setCharacter() call landed after this one started -- drop
    // this (now stale) result instead of racing it onto the mesh.
    if (requestId !== this._loadToken) return;

    if (this.model) this.mesh.remove(this.model);

    this.model = gltf.scene;
    this._isPlaceholder = false;
    const def = CHARACTERS.find((c) => c.id === id);
    const offset = def && def.rotationOffset ? def.rotationOffset : 0;
    this.model.rotation.y = this._facingY + offset;

    // Apply custom scale from GameConfig, defaulting to 1.0
    const scale = def && def.scale ? def.scale : 1.0;
    this.model.scale.set(scale, scale, scale);

    this.model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          // Tone down the HDRI skybox reflections on the character
          child.material.envMapIntensity = 0.3;
          // Natural human skin, hair, and clothing: non-metallic and soft diffuse
          child.material.metalness = 0.0;
          if (child.material.roughness < 0.6) {
            child.material.roughness = 0.65;
          }
          // Ensure hair and alpha textures write to depth buffer and render both sides
          if (child.material.transparent || child.material.alphaTest > 0) {
            child.material.depthWrite = true;
            child.material.side = THREE.DoubleSide;
          }
        }
      }
    });

    this.mesh.add(this.model);

    // If a hoverboard is active, place character feet on its top deck
    const showBoardOnLoad =
      (this.hasBoard || this._isBoardPreview) && !this.hasJetpack;
    if (showBoardOnLoad) {
      const deckThickness =
        this._currentBoardModelNode?.userData?.deckThickness ?? 0.08;
      const footOffset = this._currentBoardModelNode?.userData?.footOffset ?? 0;
      this.model.position.y =
        this.boardMesh.position.y + deckThickness + footOffset;
    }

    this.mixer = new THREE.AnimationMixer(this.model);
    this.animations = {};

    // Get all actual bone names in this specific character's skeleton
    const modelBones = [];
    this.model.traverse((child) => {
      if (child.isBone) modelBones.push(child.name);
    });

    clips.forEach((clip) => {
      const clonedClip = clip.clone();

      // Retarget each track in the animation to match this character's bones
      clonedClip.tracks.forEach((track) => {
        const parts = track.name.split(".");
        const origBone = parts[0];
        const prop = parts[1];

        let coreName = origBone.replace(/^mixamorig[0-9]*[:_]?/i, "");
        const regex = new RegExp(
          `^(mixamorig[0-9]*[:_]?)?${coreName}(_[0-9]+)?$`,
          "i",
        );

        const match = modelBones.find((b) => regex.test(b));
        if (match) {
          track.name = match + "." + prop;
        }
      });

      this.animations[clip.name] = this.mixer.clipAction(clonedClip);
    });

    // Resume active sequence or whatever was already playing
    if (this._activeSequence && this._activeSequence.length > 0) {
      const seq = this._activeSequence;
      const loop = this._sequenceLoop;
      this.stopSequence();
      this.playSequence(seq, loop);
    } else {
      const resumeName = this.animations[this.currentActionName]
        ? this.currentActionName
        : "Idle";
      const action = this.animations[resumeName];
      if (action) {
        action.reset().play();
        this.currentActionName = resumeName;
        this.currentAction = action;
      }
    }
  }
}
