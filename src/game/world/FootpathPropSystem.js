import * as THREE from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";

// ==========================================
// 🛠️ FOOTPATH PROP SYSTEM CONFIGURATION
// ==========================================
export const PROP_CONFIG = {
  SLOT_SPACING: 10,
  GROUND_PROP_SPACING: 150,
  CURB_ROW_OFFSET: 6.0,
  BUILDING_ROW_OFFSET: 10.0,
  MANHOLE_OFFSET: 7.85,
  SPAWN_CHANCE_BUILDING: 0.1,
  SPAWN_CHANCE_CURB: 0.1,
  SPAWN_CHANCE_BENCH: 0.05,
  SPAWN_CHANCE_WALKER: 10.0, // Temporarily very high so the user sees lots of characters
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
  constructor(scene, modelsMap, animations, engine) {
    this.scene = scene;
    this.models = modelsMap;
    this.animations = animations || [];
    this.engine = engine;
    this.spawnedMeshes = [];
    this.spawnedWalkers = []; // Separate array for animated NPCs
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

  spawnWalker(z, side) {
    // ==========================================
    // 🧪 ONE-BY-ONE NATIVE CHARACTER TESTING MODE
    // ==========================================
    const TEST_CHARACTER_KEY = null;

    // Use a weighted array to control spawn probabilities.
    // By adding certain characters multiple times, they will spawn more frequently!
    const nativeCharacters = [
      // Lower frequency characters (1x weight)
      "npc_female_phone",
      "npc_male_phone",
      "npc_dog",

      // High frequency characters (3x weight)
      "npc_businessman",
      "npc_businessman",
      "npc_businessman",
      "npc_thalapathy",
      "npc_thalapathy",
      "npc_thalapathy",
    ];

    // Override the random selection with the currently tested character
    let charKey = TEST_CHARACTER_KEY;
    if (!charKey) {
      // Pick a random character from the pool if no test character is forced
      charKey =
        nativeCharacters[Math.floor(Math.random() * nativeCharacters.length)];
    }

    const model = this.models[charKey];
    if (!model) return false;

    const radius = 1.0;
    if (this.isRangeReserved(side, z, radius)) return false;
    this.reserveRange(side, z, radius);

    const mesh = SkeletonUtils.clone(model);

    const embeddedAnims = this.models[charKey].animations || [];

    const box = new THREE.Box3().setFromObject(mesh);
    mesh.position.set(0, -box.min.y, 0);

    if (charKey === "npc_dog") {
      console.log(
        `[Dog Debug] Bounding Box: min(${box.min.x.toFixed(2)}, ${box.min.y.toFixed(2)}, ${box.min.z.toFixed(2)}) max(${box.max.x.toFixed(2)}, ${box.max.y.toFixed(2)}, ${box.max.z.toFixed(2)})`,
      );
      console.log(
        `[Dog Debug] Anims:`,
        embeddedAnims.map((a) => a.name).join(", "),
      );
    }

    // Fix dog mesh orientation (model is exported facing sideways)
    if (charKey === "npc_dog") {
      mesh.rotation.y = Math.PI;
    }

    const wrapper = new THREE.Group();
    wrapper.add(mesh);

    const xOffset = (Math.random() - 0.5) * 3;

    // Put flamingos high in the sky, others on the footpath
    const yPos = charKey === "npc_flamingo" ? 15.0 + Math.random() * 5.0 : 0.4;
    wrapper.position.set(side * PROP_CONFIG.CURB_ROW_OFFSET + xOffset, yPos, z);

    let mixer = null;
    let walkClip = null;
    let isLocomotion = true;
    let walksSameDirectionAsPlayer = Math.random() > 0.5;
    let currentAnimName = "none";
    const speed = 5 + Math.random() * 5;

    if (embeddedAnims.length > 0) {
      mixer = new THREE.AnimationMixer(mesh);

      // Filter out 'idle' and 'looking' animations for all characters as requested
      let validAnims = embeddedAnims.filter(
        (a) => !a.name.toLowerCase().includes("idle") && !a.name.toLowerCase().includes("looking")
      );
      
      // If we are in the lobby, ONLY allow professional animations (no jogging, running, fast walks, or sitting)
      if (this.engine && this.engine.mode === "LOBBY") {
        validAnims = validAnims.filter((a) => {
          const n = a.name.toLowerCase();
          if (n.includes("jogging") || n.includes("running") || n.includes("fast") || n.includes("sit")) return false;
          
          // The user requested to reduce basic walking in the lobby and mostly keep texting/pacing/waving.
          // We give basic walking and strut walking only a 20% chance of making it into the pool per spawn.
          if (n === "walking" || n === "strut_walking") {
            return Math.random() < 0.20; 
          }
          
          return true;
        });
      }
      
      // Fallback to embeddedAnims if there are no valid animations left
      const animsToUse = validAnims.length > 0 ? validAnims : embeddedAnims;

      if (charKey === "npc_businessman") {
        // Cycle sequentially through businessman animations to display them one by one
        this._businessmanAnimIndex = (this._businessmanAnimIndex || 0) + 1;
        walkClip = animsToUse[this._businessmanAnimIndex % animsToUse.length];

        if (walkClip) {
          const nameLower = walkClip.name.toLowerCase();
          if (
            nameLower.includes("sit") ||
            nameLower.includes("pacing") ||
            nameLower.includes("talking") ||
            nameLower.includes("waving")
            // ||
            // nameLower.includes("looking")
          ) {
            isLocomotion = false;
          }
        }
      } else if (charKey === "npc_thalapathy") {
        this._thalapathyAnimIndex = (this._thalapathyAnimIndex || 0) + 1;
        walkClip = animsToUse[this._thalapathyAnimIndex % animsToUse.length];

        if (walkClip) {
          const nameLower = walkClip.name.toLowerCase();
          if (
            nameLower.includes("sit") ||
            nameLower.includes("pacing") ||
            nameLower.includes("talking") ||
            nameLower.includes("waving") ||
            nameLower.includes("looking")
          ) {
            isLocomotion = false;
          }
        }
      } else if (charKey === "npc_ps1_male") {
        this._ps1MaleAnimIndex = (this._ps1MaleAnimIndex || 0) + 1;
        walkClip = animsToUse[this._ps1MaleAnimIndex % animsToUse.length];

        if (walkClip) {
          const nameLower = walkClip.name.toLowerCase();
          if (
            nameLower.includes("sit") ||
            nameLower.includes("pacing") ||
            nameLower.includes("talking") ||
            nameLower.includes("waving") ||
            nameLower.includes("looking")
          ) {
            isLocomotion = false;
          }
        }
      } else if (charKey === "npc_male_basic") {
        this._maleBasicAnimIndex = (this._maleBasicAnimIndex || 0) + 1;
        // Filter out 'Take 001' because his embedded Take 001 has broken root motion structure
        const safeAnims = animsToUse.filter(
          (a) => !a.name.toLowerCase().includes("take 001"),
        );
        const targetAnims = safeAnims.length > 0 ? safeAnims : animsToUse;

        walkClip = targetAnims[this._maleBasicAnimIndex % targetAnims.length];

        if (walkClip) {
          const nameLower = walkClip.name.toLowerCase();
          if (
            nameLower.includes("sit") ||
            nameLower.includes("pacing") ||
            nameLower.includes("talking") ||
            nameLower.includes("waving") ||
            nameLower.includes("looking")
          ) {
            isLocomotion = false;
          }
        }
      } else if (
        charKey === "npc_male_phone" ||
        charKey === "npc_female_phone"
      ) {
        // These characters are Biped rigs. Standard Mixamo retargeting distorts them heavily.
        // We stripped the root motion from their perfectly authored 'Take 001' animation,
        // so we will FORCE them to only play 'Take 001' (which is phone walking).
        const take001 = embeddedAnims.find((a) =>
          a.name.toLowerCase().includes("take 001"),
        );
        if (take001) {
          walkClip = take001;
          isLocomotion = true;
        } else {
          walkClip = animsToUse[0];
        }
      } else if (charKey === "npc_dog") {
        // Force the dog to run instead of idle
        const runClip = animsToUse.find((a) =>
          a.name.toLowerCase().includes("run"),
        );
        if (runClip) {
          walkClip = runClip;
        } else {
          const walkAnim = animsToUse.find((a) =>
            a.name.toLowerCase().includes("walk"),
          );
          walkClip = walkAnim || animsToUse[0];
        }
      } else {
        walkClip = animsToUse[Math.floor(Math.random() * animsToUse.length)];
      }

      currentAnimName = walkClip ? walkClip.name || "native_clip" : "none";
      if (walkClip) {
        mixer.clipAction(walkClip).play();
      }
    }

    // Explicit locomotion settings for native characters
    if (charKey === "npc_flamingo") isLocomotion = false; // Flamingo is a static flying prop

    if (charKey === "npc_flamingo") {
      wrapper.rotation.y = Math.PI; // Force all flamingos to face the exact same direction
    } else {
      // Force ALL characters (even static ones) to face parallel to the footpath!
      wrapper.rotation.y = walksSameDirectionAsPlayer ? Math.PI : 0;
    }

    const showDebugLabel = false;
    if (showDebugLabel) {
      let debugStr = `${charKey}\n[${currentAnimName}]`;
      const trackedChars = [
        "npc_thalapathy",
        "npc_female_phone",
        "npc_businessman",
        "npc_ps1_male",
        "npc_male_basic",
      ];
      if (trackedChars.includes(charKey) && walkClip) {
        debugStr += `\nTrks:${walkClip.tracks.length}`;
        if (walkClip.tracks.length > 0) {
          debugStr += `\n${walkClip.tracks[0].name}`;
        }
      }
      const sprite = this.makeTextSprite(debugStr);
      sprite.scale.set(
        sprite.userData.width * 0.5,
        sprite.userData.height * 0.5,
        1,
      );
      const height = box.max.y - box.min.y;
      sprite.position.y = height > 0 ? height + 1 : 2.5;
      wrapper.add(sprite);
    }

    this.scene.add(wrapper);

    this.spawnedWalkers.push({
      wrapper: wrapper,
      mixer: mixer,
      isLocomotion: isLocomotion,
      speed: walksSameDirectionAsPlayer ? -speed : speed,
      charKey: charKey,
      animName: currentAnimName,
    });

    console.log(
      `[FootpathPropSystem] Spawned: ${charKey} | Anim: ${currentAnimName} | Locomotion: ${isLocomotion} | Z: ${z.toFixed(1)}`,
    );

    // --- START DEBUG UI ---
    if (!window.characterDebugUIAdded) {
      window.characterDebugUIAdded = true;
      const ui = document.createElement("div");
      ui.style.position = "absolute";
      ui.style.top = "10px";
      ui.style.right = "10px";
      ui.style.background = "rgba(0,0,0,0.8)";
      ui.style.color = "white";
      ui.style.padding = "10px";
      ui.style.zIndex = "999999";
      ui.style.fontFamily = "monospace";
      ui.style.minWidth = "250px";
      ui.style.display = "none";

      const title = document.createElement("div");
      title.id = "char-debug-title";
      title.innerHTML = "<b>Live Spawn Stats</b><br/>";
      ui.appendChild(title);

      const stats = document.createElement("div");
      stats.id = "char-debug-stats";
      stats.style.marginBottom = "10px";
      stats.style.maxHeight = "300px";
      stats.style.overflowY = "auto";
      ui.appendChild(stats);

      const createSlider = (label, min, max, step, initVal, onChange) => {
        const row = document.createElement("div");
        const lbl = document.createElement("span");
        lbl.innerText = `${label}: ${initVal}`;
        lbl.style.display = "inline-block";
        lbl.style.width = "120px";
        const sl = document.createElement("input");
        sl.type = "range";
        sl.min = min;
        sl.max = max;
        sl.step = step;
        sl.value = initVal;
        sl.oninput = (e) => {
          const v = parseFloat(e.target.value);
          lbl.innerText = `${label}: ${v}`;
          onChange(v);
        };
        row.appendChild(lbl);
        row.appendChild(sl);
        ui.appendChild(row);
      };

      let debugScale = 0.015;
      let debugRotX = 0;
      let debugRotY = 0;
      let debugRotZ = 0;
      let debugPosY = 0;

      const updateAllWalkers = () => {
        this.spawnedWalkers.forEach((w) => {
          if (w.wrapper.children[0]) {
            w.wrapper.children[0].scale.set(debugScale, debugScale, debugScale);
          }
          w.wrapper.rotation.x = debugRotX;
          w.wrapper.position.y = debugPosY;
          w.wrapper.rotation.z = debugRotZ;
        });
      };

      createSlider("Scale", 0.001, 0.05, 0.001, debugScale, (v) => {
        debugScale = v;
        updateAllWalkers();
      });
      createSlider("RotX", -Math.PI, Math.PI, 0.1, debugRotX, (v) => {
        debugRotX = v;
        updateAllWalkers();
      });
      createSlider("RotZ", -Math.PI, Math.PI, 0.1, debugRotZ, (v) => {
        debugRotZ = v;
        updateAllWalkers();
      });
      createSlider("PosY", -20, 20, 0.5, debugPosY, (v) => {
        debugPosY = v;
        updateAllWalkers();
      });

      document.body.appendChild(ui);

      // Auto-update the stats every 500ms
      setInterval(() => {
        if (!window.globalFootpathSystem) return;
        const s = window.globalFootpathSystem;
        const counts = {};
        let total = 0;
        s.spawnedWalkers.forEach((w) => {
          total++;
          const key = `${w.charKey} [${w.animName}]`;
          counts[key] = (counts[key] || 0) + 1;
        });

        document.getElementById("char-debug-title").innerHTML =
          `<b>Live Spawn Stats (Total: ${total})</b><br/><br/>`;

        let html = "";
        for (const k in counts) {
          html += `<div style="font-size:11px; margin-bottom:2px;">${counts[k]}x ${k}</div>`;
        }
        document.getElementById("char-debug-stats").innerHTML = html;
      }, 500);
    }
    // Make system accessible to the interval
    window.globalFootpathSystem = this;
    // --- END DEBUG UI ---

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
        } else if (
          rand <
          PROP_CONFIG.SPAWN_CHANCE_BENCH +
            PROP_CONFIG.SPAWN_CHANCE_BUILDING +
            PROP_CONFIG.SPAWN_CHANCE_CURB +
            PROP_CONFIG.SPAWN_CHANCE_WALKER
        ) {
          this.spawnWalker(staggerZ, side);
        }
      }
    });
  }

  update(speed, delta, limitZ) {
    const moveDist = speed * delta;
    for (let i = this.spawnedMeshes.length - 1; i >= 0; i--) {
      const mesh = this.spawnedMeshes[i];
      mesh.position.z += moveDist;
      if (mesh.position.z > limitZ) {
        this.scene.remove(mesh);
        this.spawnedMeshes.splice(i, 1);
      }
    }

    for (let i = this.spawnedWalkers.length - 1; i >= 0; i--) {
      const walker = this.spawnedWalkers[i];

      // Update animation mixer, throttling it based on distance from camera if needed
      // (For now just updating it every frame)
      if (walker.mixer) {
        walker.mixer.update(delta);
      }

      // If locomotion, they walk independently along the Z axis.
      // If stationary, they only move along with the ground chunk.
      if (walker.isLocomotion) {
        walker.wrapper.position.z += moveDist + walker.speed * delta;
      } else {
        walker.wrapper.position.z += moveDist;
      }

      if (walker.wrapper.position.z > limitZ) {
        if (moveDist === 0) {
          // LOBBY MODE: Ground isn't moving, so wrap them back to the start so the lobby stays populated!
          walker.wrapper.position.z -= 400;
        } else {
          this.scene.remove(walker.wrapper);
          this.spawnedWalkers.splice(i, 1);
        }
      }
    }
    [1, -1].forEach((side) => {
      this.reservedSlots[side] = this.reservedSlots[side].filter((range) => {
        return range.startZ < 20;
      });
    });
  }
}
