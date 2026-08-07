import * as THREE from "three";
import {
  FRAMING,
  CAMERA_FOV_RANGE,
  CAMERA_RIGS,
  CAMERA_ASPECT_BLEND_RANGE,
  CAMERA_SMOOTH_TIME,
  LOBBY_ORBIT,
} from "../config/GameConfig.js";

const RAD2DEG = 180 / Math.PI;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function clamp01(v) {
  return clamp(v, 0, 1);
}

function inverseLerp(a, b, v) {
  return (v - a) / (b - a);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpRig(a, b, t) {
  return {
    height: lerp(a.height, b.height, t),
    distanceBehind: lerp(a.distanceBehind, b.distanceBehind, t),
    lookAtHeight: lerp(a.lookAtHeight, b.lookAtHeight, t),
    lookAtForwardDistance: lerp(a.lookAtForwardDistance, b.lookAtForwardDistance, t),
    followFactor: lerp(a.followFactor, b.followFactor, t),
  };
}

// Critically damped spring smoothing (the "Game Programming Gems 4" fast
// spring, the same formula behind Unity's Mathf.SmoothDamp). Framerate
// independent, converges without overshoot or jitter -- this is what
// replaced the old `position.lerp(target, 2*delta)` chase cam, which had a
// stray `Math.sin(time * 0.5) * 1.5` term added to its X target that made
// the lanes visibly drift sideways under the player during gameplay.
function springDampScalar(current, velocity, target, smoothTime, dt) {
  const omega = 2 / Math.max(smoothTime, 0.0001);
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (velocity + omega * change) * dt;
  const newVelocity = (velocity - omega * temp) * exp;
  const newValue = target + (change + temp) * exp;
  return [newValue, newVelocity];
}

function springDampVec3(current, velocity, target, smoothTime, dt) {
  const [x, vx] = springDampScalar(current.x, velocity.x, target.x, smoothTime, dt);
  const [y, vy] = springDampScalar(current.y, velocity.y, target.y, smoothTime, dt);
  const [z, vz] = springDampScalar(current.z, velocity.z, target.z, smoothTime, dt);
  current.set(x, y, z);
  velocity.set(vx, vy, vz);
}

// Solves the camera's field of view every time the viewport changes so a
// fixed world-space "play box" (FRAMING) is always fully visible -- the 3D
// equivalent of `object-fit: contain`. On a narrow portrait phone the FOV
// widens until all 3 lanes fit; on a short landscape phone it widens until
// the vertical headroom fits. Also owns the smooth chase-cam / lobby-orbit
// follow behaviour, driven by a critically damped spring rather than a
// plain lerp.
export class CameraRig {
  constructor(camera) {
    this.camera = camera;

    this.rig = { ...CAMERA_RIGS.landscape };

    this.position = new THREE.Vector3(
      LOBBY_ORBIT.basePos.x,
      LOBBY_ORBIT.baseHeight,
      LOBBY_ORBIT.basePos.z,
    );
    this.positionVelocity = new THREE.Vector3();
    this.lookAt = new THREE.Vector3(
      LOBBY_ORBIT.lookAt.x,
      LOBBY_ORBIT.lookAt.y,
      LOBBY_ORBIT.lookAt.z,
    );
    this.lookAtVelocity = new THREE.Vector3();

    this.camera.position.copy(this.position);
    this.camera.lookAt(this.lookAt);

    this._targetPos = new THREE.Vector3();
    this._targetLookAt = new THREE.Vector3();
  }

  // Called whenever ViewportManager reports a change (resize, rotation,
  // mobile URL-bar show/hide). Recomputes both the blended rig and the FOV
  // needed to keep FRAMING fully visible at this aspect ratio.
  updateFraming(viewportState) {
    const { aspect } = viewportState;

    const t = clamp01(
      inverseLerp(CAMERA_ASPECT_BLEND_RANGE[0], CAMERA_ASPECT_BLEND_RANGE[1], aspect),
    );
    this.rig = lerpRig(CAMERA_RIGS.portrait, CAMERA_RIGS.landscape, t);

    // Reference distance: camera-to-play-box, evaluated at the NEAR field
    // (the player's own position). This is deliberately NOT
    // distanceBehind + lookAheadZ: lanes only get narrower in angular terms
    // at any distance farther than this, so a FOV wide enough to frame the
    // box here always shows it at lookAheadZ too, given the track runs
    // straight ahead. lookAheadZ itself is a spawning-rule constant (see
    // Milestone 5's SpawnDirector "minimum reaction distance"), not a
    // camera input -- it doesn't vary by device, so it has no reason to
    // appear in device-dependent FOV math.
    const distance = this.rig.distanceBehind;

    const fovForY = 2 * Math.atan(FRAMING.headroomY / 2 / distance) * RAD2DEG;
    const fovForX = 2 * Math.atan(FRAMING.laneSpanX / 2 / (distance * aspect)) * RAD2DEG;

    const fov = clamp(Math.max(fovForY, fovForX), CAMERA_FOV_RANGE[0], CAMERA_FOV_RANGE[1]);

    this.camera.aspect = aspect;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  // Per-frame follow. `time` is the engine's elapsed clock time (used only
  // for the lobby's slow idle orbit); `playerX` is the player's current
  // lane position; `mode` is 'LOBBY' or 'PLAYING'.
  update(delta, time, playerX, mode) {
    const rig = this.rig;

    if (mode === "LOBBY") {
      this._targetPos.set(
        LOBBY_ORBIT.basePos.x + Math.sin(time * LOBBY_ORBIT.angularSpeed.x) * LOBBY_ORBIT.radiusX,
        LOBBY_ORBIT.baseHeight + Math.cos(time * LOBBY_ORBIT.angularSpeed.y) * LOBBY_ORBIT.heightAmplitude,
        LOBBY_ORBIT.basePos.z + Math.sin(time * LOBBY_ORBIT.angularSpeed.z) * LOBBY_ORBIT.radiusZ,
      );
      this._targetLookAt.set(LOBBY_ORBIT.lookAt.x, LOBBY_ORBIT.lookAt.y, LOBBY_ORBIT.lookAt.z);
    } else {
      this._targetPos.set(playerX * rig.followFactor, rig.height, rig.distanceBehind);
      this._targetLookAt.set(playerX, rig.lookAtHeight, -rig.lookAtForwardDistance);
    }

    springDampVec3(this.position, this.positionVelocity, this._targetPos, CAMERA_SMOOTH_TIME.position, delta);
    springDampVec3(this.lookAt, this.lookAtVelocity, this._targetLookAt, CAMERA_SMOOTH_TIME.lookAt, delta);

    this.camera.position.copy(this.position);
    this.camera.lookAt(this.lookAt);
  }
}
