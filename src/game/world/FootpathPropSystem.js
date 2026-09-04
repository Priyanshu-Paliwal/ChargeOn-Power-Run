import * as THREE from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";

// ==========================================
// 🛠️ FOOTPATH PROP SYSTEM CONFIGURATION
// ==========================================
export const PROP_CONFIG = {
  SLOT_SPACING: 10,
  GROUND_PROP_SPACING: 150,
  CURB_ROW_OFFSET: 7.5, // Increased from 6.0 to push characters further from the track/railing
  BUILDING_ROW_OFFSET: 10.0,
  MANHOLE_OFFSET: 7.85,
  SPAWN_CHANCE_BUILDING: 0.1,
  SPAWN_CHANCE_CURB: 0.1,
  SPAWN_CHANCE_BENCH: 0.05,
  SPAWN_CHANCE_WALKER: 0.25, // Restored to a reasonable density so the footpath isn't overcrowded
  SCALES: {
    coffee_food_cart: 1.5,
    ice_cream_food_cart: 1.5,
    stop_sign: 1.0,
    utility_box: 0.015,
    storm_drain: 0.015,
    manhole: 0.015,
    bench: 1.125,
    trash_large: 0.015,
    trash_small: 0.015,
    postbox: 0.015,
    hydrant: 0.015,
    airdancer: 1.0,
  },
  CUSTOM_OFFSETS: {
    bench: { x: 2.6, y: 0, z: 0, rotY: 0 },
    sitter0: { x: 2.1, y: -0.2, z: 1.0, rotY: -0.291592653589795 },
    sitter1: { x: 2.1, y: -0.3, z: -0.4, rotY: -0.141592653589795 },
    airdancer: { x: -0.6, y: 0, z: 6.5, rotY: 0.30845998458419435 },
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
    airdancer: 2,
  },
  WEIGHTS: {
    BUILDING_ROW: {
      utility_box: 5,
      postbox: 15,
      airdancer: 20,
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
    // Deterministic bench spawn tracking: stagger them so they don't face each other
    this.nextBenchZ = { 1: -25, "-1": -75 };
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

    if (propName === "airdancer") {
      mesh.traverse((child) => {
        if (child.isMesh) {
          child.material = child.material.clone();
          child.material.userData.time = { value: 0 };
          child.material.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = child.material.userData.time;
            shader.vertexShader = `
              uniform float uTime;
              ${shader.vertexShader}
            `.replace(
              "#include <begin_vertex>",
              `
              #include <begin_vertex>
              float height = 5.0; 
              float localTime = uTime * 4.0;
              float intensity = abs( fract( localTime * 0.34 - position.y / (height * 2.0) ) - 0.5 ) * 2.0;
              float heightFade = position.y / height;
              float rotation1 = sin(localTime * 0.678) * 0.7;
              float rotation2 = sin(localTime * 1.4) * 0.35;
              float rotation3 = sin(localTime * 2.4) * 0.2;
              float rot = (rotation1 + rotation2 + rotation3) * heightFade * intensity * 0.8;
              
              float c = cos(rot);
              float s = sin(rot);
              mat2 rotMat = mat2(c, -s, s, c);
              transformed.xy = rotMat * transformed.xy;
              `,
            );

            shader.vertexShader = shader.vertexShader.replace(
              "#include <beginnormal_vertex>",
              `
              #include <beginnormal_vertex>
              float n_height = 5.0; 
              float n_localTime = uTime * 4.0;
              float n_intensity = abs( fract( n_localTime * 0.34 - position.y / (n_height * 2.0) ) - 0.5 ) * 2.0;
              float n_heightFade = position.y / n_height;
              float n_rotation1 = sin(n_localTime * 0.678) * 0.7;
              float n_rotation2 = sin(n_localTime * 1.4) * 0.35;
              float n_rotation3 = sin(n_localTime * 2.4) * 0.2;
              float n_rot = (n_rotation1 + n_rotation2 + n_rotation3) * n_heightFade * n_intensity * 0.8;
              
              float n_c = cos(n_rot);
              float n_s = sin(n_rot);
              mat2 n_rotMat = mat2(n_c, -n_s, n_s, n_c);
              objectNormal.xy = n_rotMat * objectNormal.xy;
              `,
            );
          };
          this.airDancerMaterials = this.airDancerMaterials || [];
          this.airDancerMaterials.push(child.material);
        }
      });
    }

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
    } else if (faceRoad && propName !== "airdancer") {
      wrapper.rotation.y = side === 1 ? -Math.PI / 2 : Math.PI / 2;
    } else {
      wrapper.rotation.y = 0;
    }

    if (customOffset && customOffset.rotY !== undefined) {
      wrapper.rotation.y += customOffset.rotY;
    }
    wrapper.userData = {
      propName,
      baseX: x,
      baseZ: z,
      side,
      faceRoad,
      isCar,
      totalMoved: 0,
    };
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

    const numSitters = Math.floor(Math.random() * 2) + 1; // 1 or 2 sitters
    if (numSitters === 1) {
      this.spawnSitter(z, side, Math.floor(Math.random() * 2));
    } else {
      this.spawnSitter(z, side, 0);
      this.spawnSitter(z, side, 1);
    }

    return true;
  }

  spawnSitter(benchZ, side, seatIndex) {
    const characters = ["npc_businessman", "npc_thalapathy", "npc_indian_man"];
    const charKey = characters[Math.floor(Math.random() * characters.length)];
    const model = this.models[charKey];
    if (!model) return;

    const mesh = SkeletonUtils.clone(model);
    const embeddedAnims = model.animations || [];

    // Find sitting animations
    const sittingAnims = embeddedAnims.filter((a) =>
      a.name.toLowerCase().includes("sit"),
    );
    if (sittingAnims.length === 0) return;

    const anim = sittingAnims[Math.floor(Math.random() * sittingAnims.length)];

    // Setup model
    let box = new THREE.Box3().setFromObject(mesh);
    mesh.position.set(0, -box.min.y, 0);

    const wrapper = new THREE.Group();
    wrapper.add(mesh);

    const propName = `sitter${seatIndex}`;
    wrapper.userData = {
      propName,
      baseX: side * PROP_CONFIG.CURB_ROW_OFFSET,
      baseZ: benchZ,
      side,
      totalMoved: 0,
      seatIndex,
      isSitter: true,
    };

    const offset = PROP_CONFIG.CUSTOM_OFFSETS[propName];
    let finalX = wrapper.userData.baseX + side * offset.x;
    let finalY = offset.y;
    let finalZ = wrapper.userData.baseZ + offset.z;

    wrapper.position.set(finalX, finalY, finalZ);
    wrapper.rotation.y =
      (side === 1 ? -Math.PI / 2 : Math.PI / 2) + offset.rotY;

    this.scene.add(wrapper);

    let mixer = new THREE.AnimationMixer(mesh);
    mixer.clipAction(anim).play();

    this.spawnedWalkers.push({
      wrapper,
      mixer,
      isLocomotion: false,
      speed: 0,
      charKey,
    });
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
      "npc_thalapathy",
      "npc_thalapathy",
      "npc_indian_man",
      "npc_indian_man",
      "npc_indian_man",
      "npc_businessman",
      "npc_businessman",
      "npc_businessman",
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
    let box = new THREE.Box3().setFromObject(mesh);

    // Check if the model is gigantic
    if (
      charKey === "npc_gentleman" ||
      charKey === "npc_indian_man" ||
      charKey === "npc_businessman"
    ) {
      const height = box.max.y - box.min.y;
      // console.log(
      //   `[Trace] ${charKey} original height: ${height.toFixed(2)}, min: ${box.min.x.toFixed(2)}, ${box.min.y.toFixed(2)}, ${box.min.z.toFixed(2)} max: ${box.max.x.toFixed(2)}, ${box.max.y.toFixed(2)}, ${box.max.z.toFixed(2)}`,
      // );
    }

    mesh.position.set(0, -box.min.y, 0);

    if (charKey === "npc_dog") {
      // console.log(
      //   `[Dog Debug] Bounding Box: min(${box.min.x.toFixed(2)}, ${box.min.y.toFixed(2)}, ${box.min.z.toFixed(2)}) max(${box.max.x.toFixed(2)}, ${box.max.y.toFixed(2)}, ${box.max.z.toFixed(2)})`,
      // );
      if (charKey === "npc_dog") {
        // console.log(
        //   `[Dog Debug] Anims:`,
        //   embeddedAnims.map((a) => a.name).join(", "),
        // );
      }

      mesh.traverse((child) => {
        if (child.isMesh || child.isSkinnedMesh) {
          child.frustumCulled = false;
        }
      });
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
      // Also completely filter out 'sit' animations so they never spawn on the path!
      let validAnims = embeddedAnims.filter(
        (a) =>
          !a.name.toLowerCase().includes("idle") &&
          !a.name.toLowerCase().includes("looking") &&
          !a.name.toLowerCase().includes("sit"),
      );

      // If we are in the lobby, ONLY allow professional animations (no jogging, running, fast walks, or sitting)
      if (this.engine && this.engine.mode === "LOBBY") {
        validAnims = validAnims.filter((a) => {
          const n = a.name.toLowerCase();
          if (
            n.includes("jogging") ||
            n.includes("running") ||
            n.includes("fast") ||
            n.includes("sit")
          )
            return false;

          // The user requested to reduce basic walking in the lobby and mostly keep texting/pacing/waving.
          // We give basic walking and strut walking only a 20% chance of making it into the pool per spawn.
          if (n === "walking" || n === "strut_walking") {
            return Math.random() < 0.2;
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
      } else if (charKey === "npc_indian_man") {
        // Let's reuse the profMaleAnimIndex or a generic animIndex
        this._genericAnimIndex = (this._genericAnimIndex || 0) + 1;
        walkClip = animsToUse[this._genericAnimIndex % animsToUse.length];

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
        "npc_prof_male",
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

    // console.log(
    //   `[FootpathPropSystem] Spawned: ${charKey} | Anim: ${currentAnimName} | Locomotion: ${isLocomotion} | Z: ${z.toFixed(1)}`,
    // );

    // --- START DEBUG UI ---
    if (!window.characterDebugUIAdded) {
      window.characterDebugUIAdded = true;
      const ui = document.createElement("div");
      ui.style.position = "absolute";
      ui.style.top = "50px";
      ui.style.right = "10px";
      ui.style.background = "rgba(0,0,0,0.8)";
      ui.style.color = "white";
      ui.style.padding = "10px";
      ui.style.zIndex = "999999";
      ui.style.fontFamily = "monospace";
      ui.style.minWidth = "200px";
      ui.style.width = "200px";
      // ui.style.display = "block"; // Make the UI visible!
      ui.style.display = "none"; // sHide UI!

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

      let debugScale = 1.0;
      let debugRotX = 0;
      let debugRotY = 0;
      let debugRotZ = 0;
      let debugPosY = 0;

      const updateAllWalkers = () => {
        this.spawnedWalkers.forEach((w) => {
          // ONLY apply debug scale/rotation to the professional male so we don't break old characters!
          if (w.charKey === "npc_prof_male") {
            if (w.wrapper.children[0]) {
              w.wrapper.children[0].scale.set(
                debugScale,
                debugScale,
                debugScale,
              );
            }
            w.wrapper.rotation.x = debugRotX;
            w.wrapper.position.y = debugPosY;
            w.wrapper.rotation.z = debugRotZ;
          }
        });
        if (this.engine && !this.engine.isRunning && this.engine.composer) {
          this.engine.composer.render();
        }
      };

      createSlider("Scale", 0.1, 10.0, 0.1, debugScale, (v) => {
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

      createSlider("PosY", -50.0, 50.0, 0.5, debugPosY, (v) => {
        debugPosY = v;
        updateAllWalkers();
      });

      // --- AIRDANCER DEBUG UI ---
      const airdancerTitle = document.createElement("div");
      airdancerTitle.innerHTML = "<br/><b>Airdancer Offsets</b><br/>";
      ui.appendChild(airdancerTitle);

      const updateAllAirdancers = () => {
        this.spawnedMeshes.forEach((w) => {
          if (w.userData && w.userData.propName === "airdancer") {
            const scale = PROP_CONFIG.SCALES.airdancer;
            w.scale.set(scale, scale, scale);

            let finalX = w.userData.baseX;
            let finalY = 0.35;
            let finalZ = w.userData.baseZ + (w.userData.totalMoved || 0);
            const customOffset = PROP_CONFIG.CUSTOM_OFFSETS.airdancer;
            if (customOffset) {
              finalX += w.userData.side * customOffset.x;
              finalY += customOffset.y;
              finalZ += customOffset.z;
            }
            w.position.set(finalX, finalY, finalZ);

            w.rotation.y = 0; // Airdancers don't flip based on side
            if (customOffset && customOffset.rotY !== undefined) {
              w.rotation.y += customOffset.rotY;
            }
          }
        });

        console.log(
          `[Airdancer Config] Scale: ${PROP_CONFIG.SCALES.airdancer.toFixed(2)}, X: ${PROP_CONFIG.CUSTOM_OFFSETS.airdancer.x.toFixed(2)}, Y: ${PROP_CONFIG.CUSTOM_OFFSETS.airdancer.y.toFixed(2)}, Z: ${PROP_CONFIG.CUSTOM_OFFSETS.airdancer.z.toFixed(2)}, RotY: ${PROP_CONFIG.CUSTOM_OFFSETS.airdancer.rotY.toFixed(2)}`,
        );

        if (this.engine && !this.engine.isRunning && this.engine.composer) {
          this.engine.composer.render();
        }
      };

      createSlider(
        "A Scale",
        0.1,
        5.0,
        0.05,
        PROP_CONFIG.SCALES.airdancer,
        (v) => {
          PROP_CONFIG.SCALES.airdancer = v;
          updateAllAirdancers();
        },
      );
      createSlider(
        "A X",
        -10,
        10,
        0.1,
        PROP_CONFIG.CUSTOM_OFFSETS.airdancer.x,
        (v) => {
          PROP_CONFIG.CUSTOM_OFFSETS.airdancer.x = v;
          updateAllAirdancers();
        },
      );
      createSlider(
        "A Y",
        -5,
        5,
        0.1,
        PROP_CONFIG.CUSTOM_OFFSETS.airdancer.y,
        (v) => {
          PROP_CONFIG.CUSTOM_OFFSETS.airdancer.y = v;
          updateAllAirdancers();
        },
      );
      createSlider(
        "A Z",
        -10,
        10,
        0.1,
        PROP_CONFIG.CUSTOM_OFFSETS.airdancer.z,
        (v) => {
          PROP_CONFIG.CUSTOM_OFFSETS.airdancer.z = v;
          updateAllAirdancers();
        },
      );
      createSlider(
        "A RotY",
        -Math.PI,
        Math.PI,
        0.05,
        PROP_CONFIG.CUSTOM_OFFSETS.airdancer.rotY,
        (v) => {
          PROP_CONFIG.CUSTOM_OFFSETS.airdancer.rotY = v;
          updateAllAirdancers();
        },
      );

      // Helper button to calculate real bounding box
      const debugBtn = document.createElement("button");
      debugBtn.innerText = "Log Bounding Box (F12 Console)";
      debugBtn.style.marginTop = "10px";
      debugBtn.style.padding = "5px";
      debugBtn.style.cursor = "pointer";
      debugBtn.onclick = () => {
        if (this.spawnedWalkers.length > 0) {
          const w = this.spawnedWalkers[0];
          const box = new THREE.Box3().setFromObject(w.wrapper);
          const size = new THREE.Vector3();
          box.getSize(size);
          console.warn("--- ACTUAL WORLD SIZE OF CHARACTER ---");
          console.warn(`Width (X): ${size.x}`);
          console.warn(`Height (Y): ${size.y}`);
          console.warn(`Depth (Z): ${size.z}`);
          console.warn(
            "If these are ~0.01, increase Scale. If these are > 100, decrease Scale.",
          );
        } else {
          console.warn("No characters spawned yet.");
        }
      };
      ui.appendChild(debugBtn);

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
    // Clear old reservations so they don't block spawns in this new chunk!
    this.reservedSlots = { 1: [], "-1": [] };
    
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
        const staggerZ = z + (Math.random() - 0.5) * 10;

        let spawnedBenchThisSlot = false;

        // Spawn benches exactly every 100 units deterministically!
        if (z <= this.nextBenchZ[side]) {
          // If the exact spot is occupied (e.g. by a huge building overlapping), this will return false.
          // In that case, we don't decrement nextBenchZ yet; we'll try again on the very next z slot!
          const success = this.spawnBenchCluster(staggerZ, side);
          if (success) {
            this.nextBenchZ[side] -= 100;
            spawnedBenchThisSlot = true;
          }
        }

        const rand = Math.random();
        if (spawnedBenchThisSlot) {
          // Already spawned a bench here, don't spawn a building inside it
        } else if (rand < PROP_CONFIG.SPAWN_CHANCE_BUILDING) {
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
          PROP_CONFIG.SPAWN_CHANCE_BUILDING + PROP_CONFIG.SPAWN_CHANCE_CURB
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

    if (this.airDancerMaterials) {
      const time = performance.now() * 0.001;
      for (let mat of this.airDancerMaterials) {
        if (mat.userData.time) mat.userData.time.value = time;
      }
    }

    for (let i = this.spawnedMeshes.length - 1; i >= 0; i--) {
      const mesh = this.spawnedMeshes[i];
      mesh.position.z += moveDist;
      if (mesh.userData)
        mesh.userData.totalMoved = (mesh.userData.totalMoved || 0) + moveDist;
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

      if (walker.wrapper.userData) {
        walker.wrapper.userData.totalMoved =
          (walker.wrapper.userData.totalMoved || 0) + moveDist;
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
