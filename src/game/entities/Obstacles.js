import * as THREE from "three";
import { OBSTACLE_TYPES } from "../config/GameConfig.js";

// Visual factories for the 4 obstacle types (Milestone 5). Each type's
// height band is defined in GameConfig.js's OBSTACLE_TYPES, tuned jointly
// with Milestone 4's PLAYER_HITBOX so every obstacle has exactly one valid
// escape -- these meshes are built to VISUALLY match those bands, so what
// the player sees is what the hitbox actually does: the low barricade
// really only reaches y=1.0; DRONE_HIGH's hanging skirt really does reach
// all the way down to y=0.35 with no gap, while DRONE_LOW leaves open air
// beneath it down to y=1.1.
//
// Geometry/materials are created ONCE per type in the constructor (shared
// across every pooled instance across every chunk); createInstance() only
// builds a new Group + per-instance animatable references (independently
// timed flashing lights, spinning rotors), matching the zero-mid-game-
// allocation pattern already used for coins/blockers.
//
// Deliberately conservative about what gets animated: only rotation and
// material emissive intensity, NEVER position. CollisionSystem tests the
// obstacle's actual rendered Box3 (Box3.setFromObject), so any positional
// wobble would perturb the exact height-band margins Milestone 4 verified
// numerically -- not worth risking for a cosmetic bob.
export class ObstacleFactory {
  constructor() {
    this._buildBarricadeLowAssets();
    this._buildBarricadeWideAssets();
    this._buildDroneAssets();
  }

  createInstance(type) {
    switch (type) {
      case "BARRICADE_LOW":
        return this._createBarricadeLow();
      case "BARRICADE_WIDE":
        return this._createBarricadeWide();
      case "DRONE_LOW":
        return this._createDrone(OBSTACLE_TYPES.DRONE_LOW, "DRONE_LOW", false);
      case "DRONE_HIGH":
        return this._createDrone(OBSTACLE_TYPES.DRONE_HIGH, "DRONE_HIGH", true);
      default:
        throw new Error(`ObstacleFactory: unknown obstacle type "${type}"`);
    }
  }

  _createStripeTexture(width, height, stripeWidth, colorA, colorB) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = colorA;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = colorB;
    for (let i = -height; i < width; i += stripeWidth * 2) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + stripeWidth, 0);
      ctx.lineTo(i + stripeWidth + height, height);
      ctx.lineTo(i + height, height);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  // ---- BARRICADE_LOW: striped low barrier, full extent [0, 1.0] ----
  _buildBarricadeLowAssets() {
    const band = OBSTACLE_TYPES.BARRICADE_LOW;
    this.lowPostGeo = new THREE.BoxGeometry(0.25, band.heightMax, 0.25);
    this.lowPostMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.6, roughness: 0.4 });

    this.lowBoardGeo = new THREE.BoxGeometry(2.7, band.heightMax * 0.45, 0.15);
    this.lowBoardMat = new THREE.MeshStandardMaterial({
      map: this._createStripeTexture(512, 128, 64, "#E53935", "#FFFFFF"),
      roughness: 0.6,
      metalness: 0.1,
    });

    this.warningLightGeo = new THREE.SphereGeometry(0.15, 12, 12);
    this.warningLightMat = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      emissive: 0xff0000,
      emissiveIntensity: 1.0,
    });
  }

  _createBarricadeLow() {
    const band = OBSTACLE_TYPES.BARRICADE_LOW;
    const group = new THREE.Group();

    const leftPost = new THREE.Mesh(this.lowPostGeo, this.lowPostMat);
    leftPost.position.set(-1.2, band.heightMax / 2, 0);
    const rightPost = new THREE.Mesh(this.lowPostGeo, this.lowPostMat);
    rightPost.position.set(1.2, band.heightMax / 2, 0);

    const board = new THREE.Mesh(this.lowBoardGeo, this.lowBoardMat);
    board.position.set(0, band.heightMax * 0.75, 0.05);

    const leftLight = new THREE.Mesh(this.warningLightGeo, this.warningLightMat.clone());
    leftLight.position.set(-1.2, band.heightMax, 0);
    const rightLight = new THREE.Mesh(this.warningLightGeo, this.warningLightMat.clone());
    rightLight.position.set(1.2, band.heightMax, 0);

    group.add(leftPost, rightPost, board, leftLight, rightLight);

    return {
      group,
      type: "BARRICADE_LOW",
      update(time) {
        leftLight.material.emissiveIntensity = Math.sin(time * 5 + leftLight.position.x) > 0 ? 1.5 : 0.2;
        rightLight.material.emissiveIntensity = Math.sin(time * 5 + rightLight.position.x) > 0 ? 1.5 : 0.2;
      },
    };
  }

  // ---- BARRICADE_WIDE: tall hoarding spanning 2 lanes, extent [0, 2.6] ----
  // Built centered at local x=0; the caller positions the group's x at the
  // midpoint of whichever 2 adjacent lanes it's meant to cover (lanes are
  // 3 units apart, so that midpoint is +-1.5 from track center).
  _buildBarricadeWideAssets() {
    const band = OBSTACLE_TYPES.BARRICADE_WIDE;
    this.wideSpan = 6.2; // covers 2 adjacent lanes (3 apart) with clear margin
    this.wideBoardGeo = new THREE.BoxGeometry(this.wideSpan, band.heightMax, 0.2);
    this.wideBoardMat = new THREE.MeshStandardMaterial({
      map: this._createStripeTexture(1024, 256, 96, "#042C53", "#F4C775"),
      roughness: 0.5,
      metalness: 0.2,
    });
    this.wideFrameGeo = new THREE.BoxGeometry(0.3, band.heightMax, 0.3);
    this.wideFrameMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.7, roughness: 0.3 });
    this.wideLightGeo = new THREE.SphereGeometry(0.18, 12, 12);
    this.wideLightMat = new THREE.MeshStandardMaterial({
      color: 0xff6600,
      emissive: 0xff6600,
      emissiveIntensity: 1.0,
    });
  }

  _createBarricadeWide() {
    const band = OBSTACLE_TYPES.BARRICADE_WIDE;
    const group = new THREE.Group();
    const centerY = band.heightMax / 2;
    const halfSpan = this.wideSpan / 2;

    const board = new THREE.Mesh(this.wideBoardGeo, this.wideBoardMat);
    board.position.set(0, centerY, 0);
    group.add(board);

    const leftFrame = new THREE.Mesh(this.wideFrameGeo, this.wideFrameMat);
    leftFrame.position.set(-halfSpan + 0.15, centerY, 0.1);
    const rightFrame = new THREE.Mesh(this.wideFrameGeo, this.wideFrameMat);
    rightFrame.position.set(halfSpan - 0.15, centerY, 0.1);
    group.add(leftFrame, rightFrame);

    const lights = [-halfSpan + 0.3, 0, halfSpan - 0.3].map((x) => {
      const light = new THREE.Mesh(this.wideLightGeo, this.wideLightMat.clone());
      light.position.set(x, band.heightMax, 0.15);
      group.add(light);
      return light;
    });

    return {
      group,
      type: "BARRICADE_WIDE",
      update(time) {
        lights.forEach((light, i) => {
          light.material.emissiveIntensity = Math.sin(time * 4 + i * 2) > 0 ? 1.4 : 0.3;
        });
      },
    };
  }

  // ---- DRONE_LOW / DRONE_HIGH: shared body, DRONE_HIGH adds a hanging
  // striped skirt reaching all the way to its heightMin so "no gap" is
  // immediately readable, vs. DRONE_LOW's open clearance beneath it. ----
  _buildDroneAssets() {
    this.droneBodyGeo = new THREE.SphereGeometry(0.5, 12, 8);
    this.droneBodyMat = new THREE.MeshStandardMaterial({
      color: 0x2a2a2a,
      metalness: 0.8,
      roughness: 0.3,
      emissive: 0x111111,
    });
    // One thin torus standing in for all 4 rotors' swept disc, spun fast
    // around Y for a "blur" read -- 1 draw call instead of 4 arms + 4
    // rotors. Obstacles can appear several-at-once (double-* patterns,
    // gauntlet), so mesh count per instance matters for the draw-call
    // budget Milestone 3 established -- this keeps a drone at 3-4 meshes
    // total instead of 10-11.
    this.droneRotorRingGeo = new THREE.TorusGeometry(0.85, 0.05, 8, 20);
    this.droneRotorRingMat = new THREE.MeshStandardMaterial({
      color: 0x444444,
      metalness: 0.9,
      roughness: 0.2,
      transparent: true,
      opacity: 0.45,
    });
    this.droneLightGeo = new THREE.SphereGeometry(0.08, 8, 8);
    this.droneLightMat = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      emissive: 0xff0000,
      emissiveIntensity: 1.2,
    });
    this.skirtMat = new THREE.MeshStandardMaterial({
      map: this._createStripeTexture(256, 512, 48, "#E53935", "#FFFFFF"),
      roughness: 0.6,
      side: THREE.DoubleSide,
    });
  }

  _createDrone(band, typeName, hasSkirt) {
    const group = new THREE.Group();
    const bodyY = band.heightMax - 0.5;

    const body = new THREE.Mesh(this.droneBodyGeo, this.droneBodyMat);
    body.position.set(0, bodyY, 0);
    body.scale.set(1, 0.6, 1); // flattened, disc-like
    group.add(body);

    const rotorRing = new THREE.Mesh(this.droneRotorRingGeo, this.droneRotorRingMat);
    rotorRing.position.set(0, bodyY + 0.05, 0);
    rotorRing.rotation.x = Math.PI / 2;
    group.add(rotorRing);

    const downLight = new THREE.Mesh(this.droneLightGeo, this.droneLightMat.clone());
    downLight.position.set(0, bodyY - 0.32, 0);
    group.add(downLight);

    if (hasSkirt) {
      const skirtTop = bodyY - 0.3;
      const skirtHeight = skirtTop - band.heightMin;
      const skirtGeo = new THREE.PlaneGeometry(2.2, skirtHeight);
      const skirt = new THREE.Mesh(skirtGeo, this.skirtMat);
      skirt.position.set(0, band.heightMin + skirtHeight / 2, 0.01);
      group.add(skirt);
    }

    return {
      group,
      type: typeName,
      update(time) {
        rotorRing.rotation.z = time * 20;
        downLight.material.emissiveIntensity = 0.8 + Math.sin(time * 3) * 0.4;
      },
    };
  }
}
