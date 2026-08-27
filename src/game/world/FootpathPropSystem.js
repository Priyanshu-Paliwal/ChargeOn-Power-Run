import * as THREE from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";

// ==========================================
// 🛠️ FOOTPATH PROP SYSTEM CONFIGURATION
// ==========================================
export const PROP_CONFIG = {
  SLOT_SPACING: 30,
  GROUND_PROP_SPACING: 150,
  CURB_ROW_OFFSET: 6.0,
  BUILDING_ROW_OFFSET: 10.0,
  MANHOLE_OFFSET: 7.85,
  SPAWN_CHANCE_BUILDING: 0.3,
  SPAWN_CHANCE_CURB: 0.35,
  SPAWN_CHANCE_BENCH: 0.05,
  SCALES: {
    coffee_food_cart: 1.5,
    ice_cream_food_cart: 1.5,
    stop_sign: 1.0,
    utility_box: 0.015,
    storm_drain: 0.015,
    manhole: 0.015,
    bench: 0.015,
    trash_large: 0.015,
    trash_small: 0.015,
    postbox: 0.015,
    hydrant: 0.015,
  },
  CUSTOM_OFFSETS: {
    bench: { x: 0, y: 0, z: 0, rotY: Math.PI / 2 },
  },
  FOOTPRINTS: {
    bench: 2.5,
    bus_stop: 6,
    trash_large: 3,
    trash_small: 1,
    postbox: 1,
    utility_box: 1.5,
    stop_sign: 1,
    coffee_food_cart: 2.5,
    ice_cream_food_cart: 2.5,
  },
  WEIGHTS: {
    BUILDING_ROW: {
      utility_box: 5,
      postbox: 15,
    },
    CURB_ROW: {
      trash_large: 5,
      stop_sign: 15,
      coffee_food_cart: 25,
      ice_cream_food_cart: 25,
    },
  },
  BENCH_BUFFER: 3.0,
  BUS_STOP_DUSTBIN_OFFSET: 4.5,
};

export class FootpathPropSystem {
  constructor(scene, modelsMap) {
    this.scene = scene;
    this.models = modelsMap;
    this.spawnedMeshes = [];
    this.reservedSlots = {
      1: [],
      "-1": [],
    };
    this.lastSpawnedBuilding = { 1: null, "-1": null };
    this.lastSpawnedCurb = { 1: null, "-1": null };
  }

  pickRandomProp(weightTable, lastPicked) {
    let totalWeight = 0;
    const candidates = [];
    for (const [propName, weight] of Object.entries(weightTable)) {
      if (propName !== lastPicked && this.models[propName]) {
        totalWeight += weight;
        candidates.push({ name: propName, weight });
      }
    }
    if (candidates.length === 0) return null;
    let randomVal = Math.random() * totalWeight;
    for (const candidate of candidates) {
      if (randomVal < candidate.weight) return candidate.name;
      randomVal -= candidate.weight;
    }
    return candidates[0].name;
  }

  isRangeReserved(side, z, radius) {
    const start = z - radius;
    const end = z + radius;
    for (const range of this.reservedSlots[side]) {
      if (start < range.endZ && range.startZ < end) {
        return true;
      }
    }
    return false;
  }

  reserveRange(side, z, radius) {
    this.reservedSlots[side].push({
      startZ: z - radius,
      endZ: z + radius,
    });
  }

  makeTextSprite(message) {
    const fontsize = 32;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    context.font = `Bold ${fontsize}px Arial`;
    const metrics = context.measureText(message);
    const textWidth = metrics.width;
    canvas.width = textWidth + 20;
    canvas.height = fontsize + 20;
    context.fillStyle = "rgba(0, 0, 0, 0.8)";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "rgba(255, 255, 255, 1.0)";
    context.fillText(message, canvas.width / 2, canvas.height / 2);
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.userData = { width: canvas.width / 20, height: canvas.height / 20 };
    return sprite;
  }

  instantiateProp(propName, x, z, side, faceRoad = true, isCar = false) {
    if (!this.models[propName]) {
      console.warn(`[FootpathPropSystem] Missing model: ${propName}`);
      return;
    }
    const mesh = SkeletonUtils.clone(this.models[propName]);
    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const nativeSize = box.getSize(new THREE.Vector3());
    mesh.position.sub(center);
    mesh.position.y -= box.min.y - center.y;
    const scale = PROP_CONFIG.SCALES[propName] || 0.015;
    const wrapper = new THREE.Group();
    wrapper.add(mesh);
    let finalX = x;
    let finalY = 0.35;
    let finalZ = z;
    const customOffset = PROP_CONFIG.CUSTOM_OFFSETS[propName];
    if (customOffset) {
      finalX += side * customOffset.x;
      finalY += customOffset.y;
      finalZ += customOffset.z;
    }
    wrapper.position.set(finalX, finalY, finalZ);
    wrapper.scale.set(scale, scale, scale);
    if (isCar) {
      wrapper.rotation.y = side === 1 ? Math.PI : 0;
    } else if (faceRoad) {
      wrapper.rotation.y = side === 1 ? -Math.PI / 2 : Math.PI / 2;
    }
    if (customOffset && customOffset.rotY) {
      wrapper.rotation.y += customOffset.rotY;
    }
    this.scene.add(wrapper);
    this.spawnedMeshes.push(wrapper);
    return wrapper;
  }

  registerBusStopCluster(z, side) {
    const radius = PROP_CONFIG.FOOTPRINTS.bus_stop;
    this.reserveRange(side, z, radius);
    const leftZ = z + PROP_CONFIG.BUS_STOP_DUSTBIN_OFFSET;
    this.instantiateProp(
      "trash_small",
      side * PROP_CONFIG.CURB_ROW_OFFSET,
      leftZ,
      side,
      true,
    );
    const rightZ = z - PROP_CONFIG.BUS_STOP_DUSTBIN_OFFSET;
    this.instantiateProp(
      "trash_small",
      side * PROP_CONFIG.CURB_ROW_OFFSET,
      rightZ,
      side,
      true,
    );
  }

  spawnBenchCluster(z, side) {
    const radius = PROP_CONFIG.FOOTPRINTS.bench + PROP_CONFIG.BENCH_BUFFER;
    if (this.isRangeReserved(side, z, radius)) return false;
    this.reserveRange(side, z, radius);
    this.instantiateProp(
      "bench",
      side * PROP_CONFIG.CURB_ROW_OFFSET,
      z,
      side,
      true,
    );
    return true;
  }

  generateChunk(startZ, endZ) {
    const sides = [1, -1];
    for (let z = startZ; z > endZ; z -= PROP_CONFIG.GROUND_PROP_SPACING) {
      if (this.models["manhole"]) {
        sides.forEach((side) => {
          const wrapper = this.instantiateProp(
            "manhole",
            side * PROP_CONFIG.MANHOLE_OFFSET,
            z,
            side,
            false,
          );
          if (wrapper) {
            wrapper.position.y = 0.36;
            wrapper.rotation.y = Math.random() * Math.PI * 2;
          }
        });
      }
    }
    sides.forEach((side) => {
      for (let z = startZ; z > endZ; z -= PROP_CONFIG.SLOT_SPACING) {
        // Add random stagger to Z to prevent perfect grid alignment
        const staggerZ = z + (Math.random() - 0.5) * 10;

        const rand = Math.random();
        if (rand < PROP_CONFIG.SPAWN_CHANCE_BENCH) {
          this.spawnBenchCluster(staggerZ, side);
        } else if (
          rand <
          PROP_CONFIG.SPAWN_CHANCE_BENCH + PROP_CONFIG.SPAWN_CHANCE_BUILDING
        ) {
          const bProp = this.pickRandomProp(
            PROP_CONFIG.WEIGHTS.BUILDING_ROW,
            this.lastSpawnedBuilding[side],
          );
          if (bProp) {
            const bRadius = PROP_CONFIG.FOOTPRINTS[bProp];
            if (!this.isRangeReserved(side, staggerZ, bRadius)) {
              this.instantiateProp(
                bProp,
                side * PROP_CONFIG.BUILDING_ROW_OFFSET,
                staggerZ,
                side,
                true,
              );
              this.reserveRange(side, staggerZ, bRadius);
              this.lastSpawnedBuilding[side] = bProp;
            }
          }
        } else if (
          rand <
          PROP_CONFIG.SPAWN_CHANCE_BENCH +
            PROP_CONFIG.SPAWN_CHANCE_BUILDING +
            PROP_CONFIG.SPAWN_CHANCE_CURB
        ) {
          const cProp = this.pickRandomProp(
            PROP_CONFIG.WEIGHTS.CURB_ROW,
            this.lastSpawnedCurb[side],
          );
          if (cProp) {
            const cRadius = PROP_CONFIG.FOOTPRINTS[cProp];
            const isCar =
              cProp === "old_car" || cProp === "abandoned_snow_carraw";
            if (!this.isRangeReserved(side, staggerZ, cRadius)) {
              this.instantiateProp(
                cProp,
                side * PROP_CONFIG.CURB_ROW_OFFSET,
                staggerZ,
                side,
                true,
                isCar,
              );
              this.reserveRange(side, staggerZ, cRadius);
              this.lastSpawnedCurb[side] = cProp;
            }
          }
        }
      }
    });
  }

  update(speed, delta, limitZ) {
    for (let i = this.spawnedMeshes.length - 1; i >= 0; i--) {
      const mesh = this.spawnedMeshes[i];
      mesh.position.z += speed * delta;
      if (mesh.position.z > 20) {
        this.scene.remove(mesh);
        this.spawnedMeshes.splice(i, 1);
      }
    }
    [1, -1].forEach((side) => {
      this.reservedSlots[side] = this.reservedSlots[side].filter((range) => {
        return range.startZ < 20;
      });
    });
  }
}
