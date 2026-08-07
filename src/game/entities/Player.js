import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  PLAYER_PHYSICS,
  PLAYER_HITBOX,
  SLIDE_DURATION_MS,
  SLIDE_RECOVERY_MS,
  HIT_REACTION_MS,
} from "../config/GameConfig.js";

export const PlayerMovementState = {
  RUNNING: "RUNNING",
  JUMPING: "JUMPING",
  SLIDING: "SLIDING",
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

    // Animation Setup
    this.mixer = null;
    this.animations = {};
    this.currentAction = null;
    this.currentActionName = "Idle";
    this.characterVariant = 0; // 0: Navy, 1: Grey, 2: Black, 3: Beige

    // Load the AAA Character Asset (Soldier.glb)
    const loader = new GLTFLoader();
    loader.load("/models/Soldier.glb", (gltf) => {
      if (this.model) this.mesh.remove(this.model);

      this.model = gltf.scene;
      this.model.scale.set(1.5, 1.5, 1.5); // Adjust size for track
      this.model.rotation.y = 0; // Face forward down the track

      this.model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      this.setCharacterVariant(this.characterVariant);
      this.mesh.add(this.model);

      this.mixer = new THREE.AnimationMixer(this.model);
      gltf.animations.forEach((clip) => {
        this.animations[clip.name] = this.mixer.clipAction(clip);
      });

      if (this.animations["Idle"]) {
        this.currentActionName = "Idle";
        this.currentAction = this.animations["Idle"];
        this.currentAction.play();
      }
    });

    // Lane logic (never blocked by movement state -- lateral movement is
    // independent of jump/slide, matching the original).
    this.lanes = PLAYER_PHYSICS.lanes;
    this.currentLane = 1;
    this.targetX = this.lanes[this.currentLane];

    // Movement state machine
    this.movementState = PlayerMovementState.RUNNING;
    this.baseY = 0;
    this._jumpElapsed = 0;
    this._jumpAirtime = (2 * PLAYER_PHYSICS.jumpForce) / Math.abs(PLAYER_PHYSICS.gravity);
    this._slideTimer = 0;
    this._slideCooldown = 0;

    // Hit-reaction overlay (separate from movementState -- see class comment)
    this.lives = 3;
    this.isHit = false;
    this._hitTimer = 0;

    // Power-ups (Milestone 6). Both are themed to real ChargeOn features
    // (see GameConfig.js's POWER_UPS) -- collecting that specific feature
    // coin activates the buff as a side effect of normal collection credit,
    // wired from CollisionSystem/Engine.js, not from anything in here.
    this.hasMagnet = false;
    this._magnetTimer = 0;
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
  }

  // durationMs comes from GameConfig.js's POWER_UPS (via the coin's
  // userData, forwarded through CollisionSystem's onHit payload) --
  // re-collecting the same power-up REFRESHES rather than stacks, so two
  // quick pickups don't silently grant double duration.
  activateMagnet(durationMs) {
    this.hasMagnet = true;
    this._magnetTimer = durationMs;
  }

  activateShield() {
    this.hasShield = true;
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
        if (this.animations["Run"]) {
          this.animations["Run"].paused = false;
        }
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
    }

    if (this._slideCooldown > 0) {
      this._slideCooldown -= delta * 1000;
    }

    if (this.inputManager) {
      this.inputManager.prune();
      if (enabled && !this.isHit) {
        this._processInput();
      }
    }

    if (this.isHit) {
      this._hitTimer -= delta * 1000;
      if (this._hitTimer <= 0) {
        this.isHit = false;
        this._clearHitFlash();
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

    // Smooth Lane Transitioning (Framerate independent to prevent shaking/overshooting on lag)
    const lerpFactor = 1.0 - Math.exp(-PLAYER_PHYSICS.laneSwitchSpeed * delta);
    this.mesh.position.x += (this.targetX - this.mesh.position.x) * lerpFactor;

    // Banking effect
    this.mesh.rotation.z = (this.mesh.position.x - this.targetX) * -0.1;
    this.mesh.rotation.y = (this.mesh.position.x - this.targetX) * -0.15;
  }

  _processInput() {
    const laneReqs = this.inputManager.consumeLaneRequests();
    for (const dir of laneReqs) {
      if (dir < 0 && this.currentLane > 0) this.currentLane--;
      else if (dir > 0 && this.currentLane < 2) this.currentLane++;
    }
    if (laneReqs.length > 0) this.targetX = this.lanes[this.currentLane];

    // Jump/slide can only be INITIATED from RUNNING (matches the original
    // guard on both), and not during the post-slide recovery cooldown.
    if (this.movementState === PlayerMovementState.RUNNING && this._slideCooldown <= 0) {
      if (this.inputManager.consumeBuffered("jump")) {
        this._startJump();
      } else if (this.inputManager.consumeBuffered("slide")) {
        this._startSlide();
      }
    }
  }

  _startJump() {
    this.movementState = PlayerMovementState.JUMPING;
    this._jumpElapsed = 0;

    // Pause run animation to fake a jump pose (Soldier.glb has no explicit
    // jump clip -- freezing the run mid-cycle reads as an airborne pose).
    if (this.currentAction) this.currentAction.paused = true;
  }

  _startSlide() {
    this.movementState = PlayerMovementState.SLIDING;
    this._slideTimer = SLIDE_DURATION_MS;

    if (this.model) {
      this.model.rotation.x = -Math.PI / 2;
      this.model.position.y = 0.5;
      this.model.position.z = 1;
    }
  }

  _endSlide() {
    this.movementState = PlayerMovementState.RUNNING;
    this._slideCooldown = SLIDE_RECOVERY_MS;

    if (this.model) {
      this.model.rotation.x = 0;
      this.model.position.y = 0;
      this.model.position.z = 0;
    }
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
    if (this.isHit) return false;

    if (this.hasShield) {
      this.hasShield = false;
      return false; // absorbed -- no life lost, no hit-reaction lock/flash
    }

    this.isHit = true;
    this.lives--;
    this._hitTimer = HIT_REACTION_MS;

    this.model.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.emissive.setHex(0xff0000);
        child.material.emissiveIntensity = 2;
      }
    });
    return true;
  }

  _clearHitFlash() {
    this.model.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.emissive.setHex(0x000000);
      }
    });
  }

  setAnimation(animName) {
    if (!this.mixer || !this.animations[animName]) return;
    const newAction = this.animations[animName];
    const currentAction = this.animations[this.currentActionName];

    if (newAction === currentAction) return;

    if (currentAction) {
      newAction.reset();
      newAction.play();
      newAction.crossFadeFrom(currentAction, 0.5, true);
    } else {
      newAction.play();
    }

    newAction.paused = false;
    this.currentActionName = animName;
    this.currentAction = newAction;
  }

  // NOTE: this destructively flattens every material to one flat color,
  // discarding the model's own textures. Left as-is deliberately --
  // Milestone 7's CharacterLoader replaces this with proper per-slot brand
  // tinting across 4 real characters; fixing it here would just be
  // reworked again in a few milestones.
  setCharacterVariant(index) {
    this.characterVariant = index;
    if (!this.model) return;
    const colors = [
      0xffd164, // Gold Standard
      0x00b0ff, // ChargeOn Blue
      0xffffff, // Clean White
      0xd2b48c, // Beige Suit
    ];

    const selectedColor = colors[index % colors.length];

    this.model.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.color.setHex(selectedColor);
        child.material.metalness = 0.3;
        child.material.roughness = 0.7;
      }
    });
  }
}
