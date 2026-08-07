// Generates the four placeholder character models + the one shared
// animations.glb for Milestone 7, straight into public/assets/characters/.
//
// These are NOT sourced/purchased assets -- they are procedurally built
// low-poly "paper doll" humanoids (primitive body parts, vertex-colored, no
// textures) so the CharacterLoader/CharacterSelect pipeline has something
// real to load, render, animate and swap between right now. See
// docs/PROCESS_TRACKER.md's Milestone 7 notes for why: sourcing/licensing
// the FINAL branded character art (matching docs/Character-Images.png) is a
// separate, non-code decision, called out as an open item in
// docs/IMPLEMENTATION_PLAN.md. Every character here is built against the
// exact same technical contract a real Mixamo-rigged model would need to
// satisfy (see GameConfig.js's CHARACTERS comment), so swapping any one of
// these .glb files for a licensed replacement later requires zero code
// changes anywhere else in the project.
//
// Rerunnable like assets:optimize -- this script IS the source of truth for
// these files (there is no "original" to preserve in assets-src/, the same
// way optimizeAssets.js procedurally generates grass_normal.jpg directly).
//
// Usage: npm run characters:generate

import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { CHARACTERS } from "../src/game/config/GameConfig.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../public/assets/characters");

// -----------------------------------------------------------------------
// Node polyfill. GLTFExporter's binary (.glb) path builds an intermediate
// Blob, then hands it to a browser-only FileReader to get an ArrayBuffer --
// there's no FileReader in plain Node. Node's own global Blob (since
// Node 18) already exposes an async .arrayBuffer() that does the same job,
// so the polyfill just bridges that Promise-based API to FileReader's
// callback shape. (getCanvas()'s document.createElement('canvas') fallback
// elsewhere in the exporter is never hit -- these models have no textures.)
// -----------------------------------------------------------------------
class NodeFileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = buf;
      this.onloadend && this.onloadend();
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((buf) => {
      const b64 = Buffer.from(buf).toString("base64");
      this.result = `data:${blob.type || "application/octet-stream"};base64,${b64}`;
      this.onloadend && this.onloadend();
    });
  }
}
globalThis.FileReader = NodeFileReader;

// -----------------------------------------------------------------------
// Shared skeleton. Real Mixamo bone names (a Mixamo export uses exactly
// these strings) so a future licensed Mixamo-rigged replacement drops in
// without renaming a single track in animations.glb. [name, parentName,
// localPosition] -- position is in the parent's local space, so each
// limb's own offset IS that segment's length. Every limb segment is
// authored to point straight down (-Y) from its start bone so building
// its visual geometry never needs a rotation, just a Y-axis box between
// two bone world positions.
// -----------------------------------------------------------------------
const BONE_DEFS = [
  ["mixamorigHips", null, [0, 0.95, 0]],
  ["mixamorigSpine", "mixamorigHips", [0, 0.15, 0]],
  ["mixamorigSpine2", "mixamorigSpine", [0, 0.15, 0]],
  ["mixamorigNeck", "mixamorigSpine2", [0, 0.12, 0]],
  ["mixamorigHead", "mixamorigNeck", [0, 0.1, 0]],
  ["mixamorigLeftShoulder", "mixamorigSpine2", [0.16, 0.05, 0]],
  ["mixamorigLeftArm", "mixamorigLeftShoulder", [0, -0.03, 0]],
  ["mixamorigLeftForeArm", "mixamorigLeftArm", [0, -0.28, 0]],
  ["mixamorigLeftHand", "mixamorigLeftForeArm", [0, -0.25, 0]],
  ["mixamorigRightShoulder", "mixamorigSpine2", [-0.16, 0.05, 0]],
  ["mixamorigRightArm", "mixamorigRightShoulder", [0, -0.03, 0]],
  ["mixamorigRightForeArm", "mixamorigRightArm", [0, -0.28, 0]],
  ["mixamorigRightHand", "mixamorigRightForeArm", [0, -0.25, 0]],
  ["mixamorigLeftUpLeg", "mixamorigHips", [0.1, -0.02, 0]],
  ["mixamorigLeftLeg", "mixamorigLeftUpLeg", [0, -0.45, 0]],
  ["mixamorigLeftFoot", "mixamorigLeftLeg", [0, -0.42, 0]],
  ["mixamorigRightUpLeg", "mixamorigHips", [-0.1, -0.02, 0]],
  ["mixamorigRightLeg", "mixamorigRightUpLeg", [0, -0.45, 0]],
  ["mixamorigRightFoot", "mixamorigRightLeg", [0, -0.42, 0]],
];

function buildSkeletonBones(scale = 1) {
  const bones = {};
  const order = [];
  for (const [name, parent, pos] of BONE_DEFS) {
    const bone = new THREE.Bone();
    bone.name = name;
    bone.position.set(pos[0] * scale, pos[1] * scale, pos[2] * scale);
    bones[name] = bone;
    order.push(name);
    if (parent) bones[parent].add(bone);
  }
  const root = bones["mixamorigHips"];
  root.updateWorldMatrix(true, true);
  return { bones, order, root };
}

// -----------------------------------------------------------------------
// Geometry helpers. Every body part is rigidly bound to exactly ONE bone
// (skinWeight = [1,0,0,0]) -- there's no smooth blending between segments,
// which is why parts overlap slightly at joints (cheap and fully adequate
// for a placeholder; a real character model would author a continuous
// smooth-skinned mesh instead). Vertex colors (not textures) give each
// part its own material identity while keeping the whole character to ONE
// draw call, matching the rest of this codebase's draw-call discipline.
// -----------------------------------------------------------------------
function attachSkin(geo, boneIndex, color) {
  const count = geo.attributes.position.count;
  const skinIndex = new Uint16Array(count * 4);
  const skinWeight = new Float32Array(count * 4);
  const colorAttr = new Float32Array(count * 3);
  const c = new THREE.Color(color);
  for (let i = 0; i < count; i++) {
    skinIndex[i * 4] = boneIndex;
    skinWeight[i * 4] = 1;
    colorAttr[i * 3] = c.r;
    colorAttr[i * 3 + 1] = c.g;
    colorAttr[i * 3 + 2] = c.b;
  }
  geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(skinIndex, 4));
  geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(skinWeight, 4));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colorAttr, 3));
  return geo;
}

function boxPart(width, height, depth, center, boneIndex, color) {
  const geo = new THREE.BoxGeometry(Math.max(width, 0.01), Math.max(height, 0.01), Math.max(depth, 0.01));
  geo.translate(center.x, center.y, center.z);
  return attachSkin(geo, boneIndex, color);
}

function spherePart(radius, center, boneIndex, color, widthSeg = 10, heightSeg = 8) {
  const geo = new THREE.SphereGeometry(radius, widthSeg, heightSeg);
  geo.translate(center.x, center.y, center.z);
  return attachSkin(geo, boneIndex, color);
}

function addAccessory(parts, kind, headCenter, headBoneIndex, scale, hairColor) {
  if (kind === "short_hair") {
    parts.push(spherePart(0.16 * scale, headCenter.clone().add(new THREE.Vector3(0, 0.02 * scale, -0.01 * scale)), headBoneIndex, hairColor));
  } else if (kind === "ponytail") {
    parts.push(spherePart(0.16 * scale, headCenter.clone().add(new THREE.Vector3(0, 0.02 * scale, -0.01 * scale)), headBoneIndex, hairColor));
    parts.push(boxPart(0.06 * scale, 0.22 * scale, 0.06 * scale, headCenter.clone().add(new THREE.Vector3(0, -0.06 * scale, 0.14 * scale)), headBoneIndex, hairColor));
  } else if (kind === "spiky_hair") {
    for (let i = -2; i <= 2; i++) {
      parts.push(boxPart(0.05 * scale, 0.14 * scale, 0.05 * scale, headCenter.clone().add(new THREE.Vector3(i * 0.055 * scale, 0.14 * scale, 0)), headBoneIndex, hairColor));
    }
  } else if (kind === "twin_tails") {
    parts.push(spherePart(0.15 * scale, headCenter, headBoneIndex, hairColor));
    for (const side of [-1, 1]) {
      parts.push(spherePart(0.07 * scale, headCenter.clone().add(new THREE.Vector3(side * 0.18 * scale, -0.03 * scale, 0)), headBoneIndex, hairColor));
    }
  }
}

// Per-character art direction: palette + silhouette knobs layered on top of
// the CHARACTERS runtime manifest (GameConfig.js) so the id/key/url/name
// stay defined in exactly one place.
const GENERATOR_ART = {
  male_suit: {
    scale: 1.0,
    palette: { skin: "#e0ac83", hair: "#2b2118", torso: "#0b2540", pelvis: "#15202b", limb: "#15202b", foot: "#2a1a10" },
    accessory: "short_hair",
  },
  female_suit: {
    scale: 0.94,
    palette: { skin: "#e8b48f", hair: "#3b2416", torso: "#2f5d8a", pelvis: "#23405c", limb: "#23405c", foot: "#1c1c1c" },
    accessory: "ponytail",
  },
  anime_tech: {
    scale: 0.8,
    headScale: 1.5,
    palette: { skin: "#f2c9a0", hair: "#12213a", torso: "#0b2540", pelvis: "#12213a", limb: "#0b2540", foot: "#f4c775" },
    accessory: "spiky_hair",
  },
  anime_wizard: {
    scale: 0.78,
    headScale: 1.55,
    palette: { skin: "#f5cdb0", hair: "#e85fb0", torso: "#5a2a86", pelvis: "#3d1c5c", limb: "#5a2a86", foot: "#e85fb0" },
    accessory: "twin_tails",
  },
};

function buildCharacterGroup(def) {
  const art = GENERATOR_ART[def.key];
  const scale = art.scale ?? 1;
  const { bones, order, root } = buildSkeletonBones(scale);
  const boneIndex = {};
  order.forEach((name, i) => (boneIndex[name] = i));

  const worldPos = {};
  order.forEach((name) => {
    const v = new THREE.Vector3();
    bones[name].getWorldPosition(v);
    worldPos[name] = v;
  });
  const mid = (a, b) => new THREE.Vector3().addVectors(worldPos[a], worldPos[b]).multiplyScalar(0.5);
  const dist = (a, b) => worldPos[a].distanceTo(worldPos[b]);

  const p = art.palette;
  const parts = [];

  // Torso (pelvis / lower spine / upper chest), each rigid to its own bone.
  parts.push(boxPart(0.3 * scale, dist("mixamorigHips", "mixamorigSpine") + 0.05, 0.2 * scale, mid("mixamorigHips", "mixamorigSpine"), boneIndex["mixamorigHips"], p.pelvis));
  parts.push(boxPart(0.34 * scale, dist("mixamorigSpine", "mixamorigSpine2") + 0.05, 0.2 * scale, mid("mixamorigSpine", "mixamorigSpine2"), boneIndex["mixamorigSpine"], p.torso));
  parts.push(boxPart(0.36 * scale, dist("mixamorigSpine2", "mixamorigNeck") + 0.06, 0.2 * scale, mid("mixamorigSpine2", "mixamorigNeck"), boneIndex["mixamorigSpine2"], p.torso));

  // Head + hair accessory.
  const headRadius = 0.15 * scale * (art.headScale ?? 1);
  const headCenter = worldPos["mixamorigHead"].clone().add(new THREE.Vector3(0, headRadius * 0.6, 0));
  parts.push(spherePart(headRadius, headCenter, boneIndex["mixamorigHead"], p.skin));
  addAccessory(parts, art.accessory, headCenter, boneIndex["mixamorigHead"], scale, p.hair);

  // Arms + legs (mirrored).
  for (const side of ["Left", "Right"]) {
    const arm = `mixamorig${side}Arm`;
    const foreArm = `mixamorig${side}ForeArm`;
    const hand = `mixamorig${side}Hand`;
    parts.push(boxPart(0.09 * scale, dist(arm, foreArm), 0.09 * scale, mid(arm, foreArm), boneIndex[arm], p.limb));
    parts.push(boxPart(0.08 * scale, dist(foreArm, hand), 0.08 * scale, mid(foreArm, hand), boneIndex[foreArm], p.skin));
    parts.push(spherePart(0.05 * scale, worldPos[hand], boneIndex[hand], p.skin, 8, 6));

    const upLeg = `mixamorig${side}UpLeg`;
    const leg = `mixamorig${side}Leg`;
    const foot = `mixamorig${side}Foot`;
    parts.push(boxPart(0.13 * scale, dist(upLeg, leg), 0.13 * scale, mid(upLeg, leg), boneIndex[upLeg], p.limb));
    parts.push(boxPart(0.11 * scale, dist(leg, foot), 0.11 * scale, mid(leg, foot), boneIndex[leg], p.limb));
    const footCenter = worldPos[foot].clone().add(new THREE.Vector3(0, -0.02 * scale, 0.05 * scale));
    parts.push(boxPart(0.12 * scale, 0.06 * scale, 0.22 * scale, footCenter, boneIndex[foot], p.foot));
  }

  const merged = mergeGeometries(parts, false);
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05 });
  const mesh = new THREE.SkinnedMesh(merged, material);
  mesh.name = def.key;
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const skeleton = new THREE.Skeleton(order.map((n) => bones[n]));
  mesh.bind(skeleton);
  mesh.frustumCulled = false;

  const group = new THREE.Group();
  group.name = `${def.key}_root`;
  group.add(root);
  group.add(mesh);
  return group;
}

// -----------------------------------------------------------------------
// Shared animation clips. Rotation-only (no position tracks) on purpose:
// each of the 4 characters has a DIFFERENT scale/proportions (chibi anime
// characters are shorter with bigger heads), so a position-space keyframe
// (e.g. "move the hip up 0.05 units") authored against one character's
// bind pose would look wrong on another. Rotations are proportion-
// independent -- the same clip reads correctly on every skeleton regardless
// of bone length, which is what actually makes ONE shared animations.glb
// work across 4 differently-sized characters.
// -----------------------------------------------------------------------
function eulerQuat(x, y, z) {
  return new THREE.Quaternion().setFromEuler(
    new THREE.Euler(THREE.MathUtils.degToRad(x), THREE.MathUtils.degToRad(y), THREE.MathUtils.degToRad(z))
  );
}

function track(bone, times, eulers) {
  const values = [];
  for (const [x, y, z] of eulers) {
    const q = eulerQuat(x, y, z);
    values.push(q.x, q.y, q.z, q.w);
  }
  return new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, values);
}

function buildClips() {
  return [
    // Loop, subtle breathing sway.
    new THREE.AnimationClip("Idle", 2.4, [
      track("mixamorigSpine2", [0, 1.2, 2.4], [[0, 0, 3], [0, 0, -3], [0, 0, 3]]),
      track("mixamorigHead", [0, 1.2, 2.4], [[0, -4, 0], [0, 4, 0], [0, -4, 0]]),
      track("mixamorigLeftArm", [0, 1.2, 2.4], [[2, 0, 0], [-2, 0, 0], [2, 0, 0]]),
      track("mixamorigRightArm", [0, 1.2, 2.4], [[-2, 0, 0], [2, 0, 0], [-2, 0, 0]]),
    ]),
    // Loop, 0.5s gait cycle -- opposite-phase arm/leg swing plus a knee bend.
    new THREE.AnimationClip("Run", 0.5, [
      track("mixamorigLeftArm", [0, 0.125, 0.25, 0.375, 0.5], [[-40, 0, 0], [0, 0, 0], [40, 0, 0], [0, 0, 0], [-40, 0, 0]]),
      track("mixamorigRightArm", [0, 0.125, 0.25, 0.375, 0.5], [[40, 0, 0], [0, 0, 0], [-40, 0, 0], [0, 0, 0], [40, 0, 0]]),
      track("mixamorigLeftUpLeg", [0, 0.125, 0.25, 0.375, 0.5], [[45, 0, 0], [0, 0, 0], [-45, 0, 0], [0, 0, 0], [45, 0, 0]]),
      track("mixamorigRightUpLeg", [0, 0.125, 0.25, 0.375, 0.5], [[-45, 0, 0], [0, 0, 0], [45, 0, 0], [0, 0, 0], [-45, 0, 0]]),
      track("mixamorigLeftLeg", [0, 0.125, 0.25, 0.375, 0.5], [[10, 0, 0], [70, 0, 0], [10, 0, 0], [0, 0, 0], [10, 0, 0]]),
      track("mixamorigRightLeg", [0, 0.125, 0.25, 0.375, 0.5], [[10, 0, 0], [0, 0, 0], [10, 0, 0], [70, 0, 0], [10, 0, 0]]),
      track("mixamorigSpine2", [0, 0.25, 0.5], [[0, 5, 0], [0, -5, 0], [0, 5, 0]]),
    ]),
    // Non-loop, authored at 0.6s. Player.js stretches this to the real
    // physics jump airtime via AnimationAction.setDuration() so it always
    // matches PLAYER_PHYSICS regardless of future retuning.
    new THREE.AnimationClip("Jump", 0.6, [
      track("mixamorigLeftUpLeg", [0, 0.1, 0.3, 0.5, 0.6], [[0, 0, 0], [-30, 0, 0], [50, 0, 0], [50, 0, 0], [0, 0, 0]]),
      track("mixamorigRightUpLeg", [0, 0.1, 0.3, 0.5, 0.6], [[0, 0, 0], [-30, 0, 0], [50, 0, 0], [50, 0, 0], [0, 0, 0]]),
      track("mixamorigLeftLeg", [0, 0.1, 0.3, 0.5, 0.6], [[0, 0, 0], [20, 0, 0], [90, 0, 0], [70, 0, 0], [0, 0, 0]]),
      track("mixamorigRightLeg", [0, 0.1, 0.3, 0.5, 0.6], [[0, 0, 0], [20, 0, 0], [90, 0, 0], [70, 0, 0], [0, 0, 0]]),
      track("mixamorigLeftArm", [0, 0.1, 0.3, 0.6], [[0, 0, 0], [-20, 0, 0], [-60, 0, 20], [0, 0, 0]]),
      track("mixamorigRightArm", [0, 0.1, 0.3, 0.6], [[0, 0, 0], [-20, 0, 0], [-60, 0, -20], [0, 0, 0]]),
      track("mixamorigSpine2", [0, 0.1, 0.3, 0.6], [[0, 0, 0], [10, 0, 0], [-10, 0, 0], [0, 0, 0]]),
    ]),
    // Loop -- authored for the contract, not yet wired into Player.js
    // (there is no distinct "falling" sub-state in the movement state
    // machine; JUMPING's analytic formula already covers the full arc).
    new THREE.AnimationClip("Fall", 0.4, [
      track("mixamorigLeftUpLeg", [0, 0.2, 0.4], [[10, 0, 0], [15, 0, 0], [10, 0, 0]]),
      track("mixamorigRightUpLeg", [0, 0.2, 0.4], [[10, 0, 0], [15, 0, 0], [10, 0, 0]]),
      track("mixamorigLeftArm", [0, 0.2, 0.4], [[-10, 0, 10], [-15, 0, 10], [-10, 0, 10]]),
      track("mixamorigRightArm", [0, 0.2, 0.4], [[-10, 0, -10], [-15, 0, -10], [-10, 0, -10]]),
    ]),
    // Non-loop -- authored for the contract, not yet wired into Player.js.
    new THREE.AnimationClip("Land", 0.25, [
      track("mixamorigLeftUpLeg", [0, 0.1, 0.25], [[0, 0, 0], [35, 0, 0], [0, 0, 0]]),
      track("mixamorigRightUpLeg", [0, 0.1, 0.25], [[0, 0, 0], [35, 0, 0], [0, 0, 0]]),
      track("mixamorigLeftLeg", [0, 0.1, 0.25], [[0, 0, 0], [55, 0, 0], [0, 0, 0]]),
      track("mixamorigRightLeg", [0, 0.1, 0.25], [[0, 0, 0], [55, 0, 0], [0, 0, 0]]),
      track("mixamorigSpine2", [0, 0.1, 0.25], [[0, 0, 0], [15, 0, 0], [0, 0, 0]]),
    ]),
    // Non-loop, authored at 0.7s (== SLIDE_DURATION_MS). Player.js stretches
    // this via setDuration() too, for the same retuning-safety reason as Jump.
    new THREE.AnimationClip("Slide", 0.7, [
      track("mixamorigSpine", [0, 0.15, 0.55, 0.7], [[0, 0, 0], [45, 0, 0], [45, 0, 0], [0, 0, 0]]),
      track("mixamorigSpine2", [0, 0.15, 0.55, 0.7], [[0, 0, 0], [25, 0, 0], [25, 0, 0], [0, 0, 0]]),
      track("mixamorigLeftUpLeg", [0, 0.15, 0.55, 0.7], [[0, 0, 0], [-40, 0, 0], [-40, 0, 0], [0, 0, 0]]),
      track("mixamorigRightUpLeg", [0, 0.15, 0.55, 0.7], [[0, 0, 0], [-40, 0, 0], [-40, 0, 0], [0, 0, 0]]),
      track("mixamorigLeftLeg", [0, 0.15, 0.55, 0.7], [[0, 0, 0], [80, 0, 0], [80, 0, 0], [0, 0, 0]]),
      track("mixamorigRightLeg", [0, 0.15, 0.55, 0.7], [[0, 0, 0], [80, 0, 0], [80, 0, 0], [0, 0, 0]]),
      track("mixamorigLeftArm", [0, 0.15, 0.55, 0.7], [[0, 0, 0], [-70, 0, 0], [-70, 0, 0], [0, 0, 0]]),
      track("mixamorigRightArm", [0, 0.15, 0.55, 0.7], [[0, 0, 0], [-70, 0, 0], [-70, 0, 0], [0, 0, 0]]),
    ]),
    // Non-loop -- authored for the contract; Milestone 9 (juice) owns
    // wiring an actual hit-reaction animation into Player.takeHit().
    new THREE.AnimationClip("Stumble", 0.5, [
      track("mixamorigSpine2", [0, 0.15, 0.35, 0.5], [[0, 0, 0], [-25, 0, 15], [10, 0, -8], [0, 0, 0]]),
      track("mixamorigHead", [0, 0.15, 0.35, 0.5], [[0, 0, 0], [15, 10, 0], [-5, -4, 0], [0, 0, 0]]),
      track("mixamorigLeftArm", [0, 0.15, 0.5], [[0, 0, 0], [-40, 0, -30], [0, 0, 0]]),
      track("mixamorigRightArm", [0, 0.15, 0.5], [[0, 0, 0], [-40, 0, 30], [0, 0, 0]]),
    ]),
    // Loop -- authored for the contract; Milestone 8/9 own wiring this into
    // Level Complete / Victory screens.
    new THREE.AnimationClip("Celebrate", 1.6, [
      track("mixamorigLeftArm", [0, 0.4, 0.8, 1.2, 1.6], [[-160, 0, 20], [-160, 0, -20], [-160, 0, 20], [-160, 0, -20], [-160, 0, 20]]),
      track("mixamorigRightArm", [0, 0.4, 0.8, 1.2, 1.6], [[-160, 0, -20], [-160, 0, 20], [-160, 0, -20], [-160, 0, 20], [-160, 0, -20]]),
      track("mixamorigSpine2", [0, 0.4, 0.8, 1.2, 1.6], [[0, 10, 0], [0, -10, 0], [0, 10, 0], [0, -10, 0], [0, 10, 0]]),
      track("mixamorigHead", [0, 0.4, 0.8, 1.2, 1.6], [[-10, 0, 0], [-5, 0, 0], [-10, 0, 0], [-5, 0, 0], [-10, 0, 0]]),
    ]),
  ];
}

function exportGLB(object3D, animations, outPath) {
  const exporter = new GLTFExporter();
  return new Promise((resolve, reject) => {
    exporter.parse(object3D, resolve, reject, { binary: true, animations });
  }).then((arrayBuffer) => {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, Buffer.from(arrayBuffer));
    return arrayBuffer.byteLength;
  });
}

async function main() {
  const clips = buildClips();

  // animations.glb: the bone hierarchy only, no mesh. AnimationMixer
  // resolves each clip's tracks by NODE NAME against whatever root a
  // character's own mixer is created with, so this file only needs to
  // provide the names -- it never needs to be loaded alongside a specific
  // character's mesh at runtime.
  const { root: animRoot } = buildSkeletonBones(1);
  const animGroup = new THREE.Group();
  animGroup.name = "SharedSkeleton";
  animGroup.add(animRoot);
  const animBytes = await exportGLB(animGroup, clips, path.join(OUT_DIR, "animations.glb"));
  console.log(`animations.glb: ${clips.length} clips -> ${(animBytes / 1024).toFixed(1)} KB`);

  for (const def of CHARACTERS) {
    const group = buildCharacterGroup(def);
    // No embedded animations on character files -- see GameConfig.js's
    // CHARACTERS contract comment.
    const outPath = path.resolve(__dirname, "..", "public", def.url.replace(/^\//, ""));
    const bytes = await exportGLB(group, [], outPath);
    console.log(`${def.key}.glb: ${(bytes / 1024).toFixed(1)} KB`);
  }

  console.log("\nDone. Run `npm run assets:check` to confirm the total public/ budget is still met.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
