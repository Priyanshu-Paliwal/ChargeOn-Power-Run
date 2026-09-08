import * as THREE from "three";

// Replaces WorldGenerator's per-recycle SkeletonUtils.clone() of railings,
// trees, buildings and streetlights (the ~0.67s frame hitch, since every
// chunk recycle deep-cloned ~80 GLB objects) with a fixed pool of
// InstancedMesh instances per scenery variant, shared globally across every
// chunk. Recycling a chunk becomes a handful of Matrix4 writes into
// pre-allocated buffers -- no allocation, no cloning, no new draw calls.
//
// Each chunk's scenery slots are assigned to a FIXED (pool, instanceIndex)
// pair exactly once, at startup, and never reallocated. Only the WORLD
// TRANSFORM (driven by the chunk's current Z plus per-recycle jitter) and
// VISIBILITY change afterward. This trades "every recycle can pick any
// species for any slot" for "every slot has one fixed species forever, but
// still gets fresh position/scale/visibility every lap" -- imperceptible in
// play, and it means no free-list/allocator is needed at all.
//
// Building models ship 3 LOD (level-of-detail) variants per the source
// GLBs (e.g. "L_Build_1", "L_Build_1_LOD1", "L_Build_1_LOD2", all at
// identical transform) -- the previous code's generic mesh traversal
// applied a material to EVERY one of them and rendered all 3 stacked
// simultaneously. This picks only the highest-detail one (LOD0).

// 🌲 AIRPORT PLANT CONFIGURATION 🌲
const TREE_SPECIES = ["airport_plant"]; // Uses your new plant and folio tree
const TREE_HEIGHT_RANGE = [2, 2]; // HEIGHT: [minHeight, maxHeight]
const TREE_WIDTH_MULTIPLIER = 1.0; // WIDTH: Increase to make them fatter, decrease for thinner

// 🌳 POSITIONING CONTROLS 🌳
const TREES_PER_SIDE = 15; // NUMBER OF PLANTS: How many plants in a row per chunk side
const TREE_X_POSITION = 5.2; // POSITION: Distance from center. 4.8 is railing. 14.0 is near houses!
const TREE_Y_POSITION = 0; // UP/DOWN: Adjust this to sink them into the footpath or float them higher!
const TREE_Z_SPACING = 10; // GAP: Distance between each plant (smaller = closer together side-by-side)
const FAR_TREES_PER_SIDE = 0; // (kept 0 to clear space behind houses)
const FOOTPATH_PROP_KEYS = []; // Removed to let FootpathPropSystem handle props!
const BUILDING_VARIANTS = [
  "PublicBuilding_1",
  "PublicBuilding_2",
  "PublicBuilding_3",
  "PublicBuilding_4",
  "PublicBuilding_5",
  "PublicBuilding_6",
  "PublicBuilding_7",
  "PublicBuilding_8",
  "PublicBuilding_9",
  "PublicBuilding_10",
  "RestaurantBuilding",
  "ShopBuilding",
  "PizzaBuilding",
  "BurgerBuilding",
  "CafeBuilding",
  "ShoppingCenterBuilding",
  "Cinema",
];

const RARE_BUILDINGS = [
  "Cinema",
  "ShoppingCenterBuilding",
  "RestaurantBuilding",
];

const LARGE_BUILDINGS = [
  "PublicBuilding_9",
  "PublicBuilding_2",
  "PublicBuilding_8",
  "PublicBuilding_1",
  "PublicBuilding_10",
];

const COMMERCIAL_BUILDINGS = [
  "BurgerBuilding",
  "PizzaBuilding",
  "CafeBuilding",
  "ShopBuilding",
];

// TREE_HEIGHT_RANGE moved to top config block
const BUILDING_SCALE = {
  PublicBuilding_1: 250,
  PublicBuilding_2: 200,
  PublicBuilding_3: 350,
  PublicBuilding_4: 350,
  PublicBuilding_5: 350,
  PublicBuilding_6: 300,
  PublicBuilding_7: 350,
  PublicBuilding_8: 200,
  PublicBuilding_9: 200,
  PublicBuilding_10: 200,
  RestaurantBuilding: 350,
  ShopBuilding: 350,
  PizzaBuilding: 350,
  BurgerBuilding: 350,
  CafeBuilding: 350,
  ShoppingCenterBuilding: 400, // Reduced from 700 to look normal
  Cinema: 250, // Reduced from 600 to look normal
};

const BUILDING_ROTATION_ADJUSTMENT = {
  PublicBuilding_1: -Math.PI / 2,
  PublicBuilding_2: -Math.PI / 2,
  PublicBuilding_3: -Math.PI / 2,
  PublicBuilding_4: -Math.PI / 2,
  PublicBuilding_5: -Math.PI / 2,
  PublicBuilding_6: -Math.PI / 2,
  PublicBuilding_7: -Math.PI / 2,
  PublicBuilding_8: -Math.PI / 2,
  PublicBuilding_9: -Math.PI / 2,
  PublicBuilding_10: -Math.PI / 2,
  RestaurantBuilding: 0,
  ShopBuilding: 0,
  PizzaBuilding: 0,
  BurgerBuilding: 0,
  CafeBuilding: 0,
  ShoppingCenterBuilding: 0,
  Cinema: 0,
};

const BUILDING_TRACK_MARGIN = 11.0; // Distance from center of track to the building's front face (matches outer edge of 10.85 footpath)
const BUILDING_ROTATION_OFFSET = Math.PI / 2; // Adjust if buildings face backward
const TARGET_BUILDING_WIDTH = 14; // Fixed width along the track to ensure perfect 6-unit gaps in a 20-unit chunk

const _m1 = new THREE.Matrix4();
const _m2 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0); // degenerate: renders nothing
const _UP = new THREE.Vector3(0, 1, 0);

function extractMeshInfos(root) {
  root.updateMatrixWorld(true);
  const infos = [];
  root.traverse((child) => {
    if (child.isMesh) {
      infos.push({
        geometry: child.geometry,
        material: child.material,
        matrix: child.matrixWorld.clone(),
        vertexCount: child.geometry.attributes.position?.count || 0,
      });
    }
  });
  return infos;
}

function getBuildingLengthAlongTrack(variant, rotY, baseScale, buildingSizes) {
  const size = buildingSizes[variant];
  if (!size) return 20;
  const cos = Math.abs(Math.cos(rotY));
  const sin = Math.abs(Math.sin(rotY));
  return (size.x * sin + size.z * cos) * baseScale;
}

function getBuildingDepthAwayFromTrack(
  variant,
  rotY,
  baseScale,
  buildingSizes,
) {
  const size = buildingSizes[variant];
  if (!size) return 20;
  const cos = Math.abs(Math.cos(rotY));
  const sin = Math.abs(Math.sin(rotY));
  return (size.x * cos + size.z * sin) * baseScale;
}

function boundingBoxHeightOf(parts) {
  const box = new THREE.Box3();
  const tempBox = new THREE.Box3();
  let any = false;
  for (const p of parts) {
    p.geometry.computeBoundingBox();
    if (!p.geometry.boundingBox) continue;
    tempBox.copy(p.geometry.boundingBox).applyMatrix4(p.matrix);
    box.union(tempBox);
    any = true;
  }
  return any ? box.max.y - box.min.y : 1;
}

// A single scenery variant's renderable pieces (usually 1, sometimes 2 for
// trees which have separate foliage/bark materials). `naturalHeight` is the
// combined bounding-box height of all parts at their canonical transform,
// used to normalize trees to the game's target height range.
function buildVariant(model) {
  if (!model) return null;
  const parts = extractMeshInfos(model);
  if (parts.length === 0) return null;
  return { parts, naturalHeight: boundingBoxHeightOf(parts) };
}

function buildPropVariant(model) {
  if (!model) return null;
  const infos = extractMeshInfos(model);
  if (infos.length === 0) return null;

  const box = new THREE.Box3();
  const tempBox = new THREE.Box3();
  let any = false;
  for (const p of infos) {
    p.geometry.computeBoundingBox();
    if (!p.geometry.boundingBox) continue;
    tempBox.copy(p.geometry.boundingBox).applyMatrix4(p.matrix);
    box.union(tempBox);
    any = true;
  }
  if (!any) return null;

  const center = new THREE.Vector3();
  box.getCenter(center);

  // Center X and Z, and place the BOTTOM at Y=0
  const centering = new THREE.Matrix4().makeTranslation(
    -center.x,
    -box.min.y,
    -center.z,
  );

  const parts = infos.map((p) => {
    const canonical = new THREE.Matrix4().multiplyMatrices(centering, p.matrix);
    return { geometry: p.geometry, material: p.material, matrix: canonical };
  });

  return { parts, naturalHeight: box.max.y - box.min.y };
}

// Buildings ship LOD0/LOD1/LOD2 at identical transforms; keep only the
// highest-vertex-count (=highest detail) one, and compute the centering
// offset the original code derived from the model's bounding box so the
// building's visual center sits at local (0, y, 0).
function buildBuildingVariant(model) {
  if (!model) return null;
  const infos = extractMeshInfos(model);
  if (infos.length === 0) return null;
  infos.sort((a, b) => b.vertexCount - a.vertexCount);
  const lod0 = infos[0];

  lod0.geometry.computeBoundingBox();
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  lod0.geometry.boundingBox.getCenter(center);
  lod0.geometry.boundingBox.getSize(size);
  center.applyMatrix4(lod0.matrix);
  // Also transform size to get approximate world-aligned bounds
  const sizeX =
    Math.abs(size.x * lod0.matrix.elements[0]) +
    Math.abs(size.z * lod0.matrix.elements[8]);
  const sizeZ =
    Math.abs(size.x * lod0.matrix.elements[2]) +
    Math.abs(size.z * lod0.matrix.elements[10]);

  const centering = new THREE.Matrix4().makeTranslation(
    -center.x,
    0,
    -center.z,
  );
  const canonical = new THREE.Matrix4().multiplyMatrices(
    centering,
    lod0.matrix,
  );

  return {
    parts: [
      { geometry: lod0.geometry, material: lod0.material, matrix: canonical },
    ],
    size: { x: sizeX, z: sizeZ },
  };
}

// One InstancedMesh per (variant, part). Instance transforms are written
// directly via setMatrixAt -- no allocation after construction.
class InstancePool {
  constructor(scene, geometry, material, capacity) {
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false; // Prevent disappearing when camera swings, as instances span the entire track
    // Instances start fully collapsed so nothing renders at the origin
    // before the first real chunk assignment runs.
    for (let i = 0; i < capacity; i++) this.mesh.setMatrixAt(i, _zeroMatrix);
    scene.add(this.mesh);
    this._dirty = false;
  }

  setTransform(index, matrix) {
    this.mesh.setMatrixAt(index, matrix);
    this._dirty = true;
  }

  hide(index) {
    this.mesh.setMatrixAt(index, _zeroMatrix);
    this._dirty = true;
  }

  flush() {
    if (this._dirty) {
      this.mesh.instanceMatrix.needsUpdate = true;
      this._dirty = false;
    }
  }

  dispose() {
    this.mesh.geometry.dispose();
    if (Array.isArray(this.mesh.material))
      this.mesh.material.forEach((m) => m.dispose());
    else this.mesh.material?.dispose();
  }
}

// A named scenery variant may need multiple InstancePools (one per
// geometry/material "part" -- e.g. a tree's foliage and bark).
class MultiPartPool {
  constructor(scene, variantData, capacity) {
    this.parts = variantData.parts.map(
      (p) => new InstancePool(scene, p.geometry, p.material, capacity),
    );
    this.partLocalMatrices = variantData.parts.map((p) => p.matrix);
    this.naturalHeight = variantData.naturalHeight ?? null;
  }

  // `placement` is the slot's own (position/rotation/scale) matrix; each
  // part's fixed local offset (baked node transform, or the building
  // centering offset) is composed underneath it.
  setTransform(index, placement) {
    for (let i = 0; i < this.parts.length; i++) {
      _m1.multiplyMatrices(placement, this.partLocalMatrices[i]);
      this.parts[i].setTransform(index, _m1);
    }
  }

  hide(index) {
    for (const part of this.parts) part.hide(index);
  }

  flush() {
    for (const part of this.parts) part.flush();
  }

  dispose() {
    for (const part of this.parts) part.dispose();
  }
}

// Returns the SAME shared scratch Matrix4 every call, not a clone --
// InstancedMesh.setMatrixAt() copies the 16 floats into its own buffer
// immediately, so nothing needs to retain this reference between calls.
// This function alone is called for every scenery instance every frame
// (~1000+ times); allocating a new Matrix4 per call here would be exactly
// the per-frame allocation this whole module exists to eliminate.
function composePlacement(x, y, z, rotY, scale, widthScale = 1.0) {
  _pos.set(x, y, z);
  _quat.setFromAxisAngle(_UP, rotY);
  // widthScale only scales X and Z to make it fatter/thinner without affecting height
  _scale.set(scale * widthScale, scale, scale * widthScale);
  const result = _m2.compose(_pos, _quat, _scale);
  return result;
}

export class SceneryInstancer {
  constructor(scene, chunkCount, trackBuilder) {
    this.scene = scene;
    this.chunkCount = chunkCount;
    this.trackBuilder = trackBuilder;
    this.pools = {}; // name -> MultiPartPool
    this.ready = false;
    this._nextIndex = {}; // name -> next free instance index (fixed allocation, never freed)
    this.activeLeftBuildings = [];
    this.activeRightBuildings = [];
    this.nextLeftBuildingZ = 10; // activeZ starts at 10
    this.nextRightBuildingZ = 10;
    this.buildingCounterLeft = 0;
    this.buildingCounterRight = 0;

    this.leftBlock = {
      type: null,
      variant: null,
      remaining: 0,
      lastVariant: null,
    };
    this.rightBlock = {
      type: null,
      variant: null,
      remaining: 0,
      lastVariant: null,
    };

    this.chunkLength = 20;
  }

  _allocPool(name, variantData, capacity) {
    this.pools[name] = new MultiPartPool(this.scene, variantData, capacity);
    this._nextIndex[name] = 0;
  }

  _take(name) {
    const pool = this.pools[name];
    if (!pool) throw new Error(`SceneryInstancer: pool "${name}" not found`);
    const capacity = pool.parts[0].mesh.count;
    const idx = this._nextIndex[name] % capacity;
    this._nextIndex[name]++;
    return idx;
  }

  _createBannerTexture(textureUrl) {
    const canvas = document.createElement("canvas");
    // 2048 x 910 matches the 1.8 x 0.8 banner plane aspect ratio (2.25 : 1) with 2K sharpness
    canvas.width = 2048;
    canvas.height = 910;
    const ctx = canvas.getContext("2d");

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 16;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = textureUrl;
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const naturalW = img.naturalWidth || img.width || 1000;
      const naturalH = img.naturalHeight || img.height || 300;
      const imgRatio = naturalW / naturalH;

      // Fit inside canvas while strictly preserving the true aspect ratio
      const maxW = canvas.width * 0.90;
      const maxH = canvas.height * 0.82;

      let drawW = maxW;
      let drawH = drawW / imgRatio;
      if (drawH > maxH) {
        drawH = maxH;
        drawW = drawH * imgRatio;
      }

      const drawX = (canvas.width - drawW) / 2;
      const drawY = (canvas.height - drawH) / 2;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, drawX, drawY, drawW, drawH);

      tex.needsUpdate = true;
    };

    return tex;
  }

  _createBannerPool(n, poolName, textureUrl) {
    // === BANNER CONFIGURATION ===
    const CONFIG = {
      fabricWidth: 1,
      fabricHeight: 2.4,
      fabricColor: 0xffffff,
      logoWidth: 1.8, // The physical width of the image on the flag (Before rotation)
      logoHeight: 0.8, // The physical height of the image on the flag (Before rotation)
      logoOffsetY: 0.0,
      logoRotation: -Math.PI / 2,
      distanceFromPole: -0.9,
      mountHeight: 5,
    };

    this.bannerMountHeight = CONFIG.mountHeight;
    const halfHeight = CONFIG.fabricHeight / 2;

    const bracketGeo = new THREE.BoxGeometry(1.6, 0.05, 0.05);
    bracketGeo.translate(-0.8, 0, 0);
    const bracketMat = new THREE.MeshStandardMaterial({
      color: 0x222222,
      metalness: 0.8,
      roughness: 0.4,
    });

    const fabricGeo = new THREE.PlaneGeometry(
      CONFIG.fabricWidth,
      CONFIG.fabricHeight,
      4,
      8,
    );
    fabricGeo.translate(0, -halfHeight, 0);
    fabricGeo.translate(CONFIG.distanceFromPole, 0, 0);
    const fabricMat = new THREE.MeshStandardMaterial({
      color: CONFIG.fabricColor,
      side: THREE.DoubleSide,
      roughness: 0.9,
    });

    // We build the plane using your EXACT configured width and height!
    const logoGeoFront = new THREE.PlaneGeometry(
      CONFIG.logoWidth,
      CONFIG.logoHeight,
      4,
      4,
    );
    if (CONFIG.logoRotation !== 0) logoGeoFront.rotateZ(CONFIG.logoRotation);
    logoGeoFront.translate(0, -halfHeight + CONFIG.logoOffsetY, 0);
    logoGeoFront.translate(CONFIG.distanceFromPole, 0, 0.015);

    const logoGeoBack = new THREE.PlaneGeometry(
      CONFIG.logoWidth,
      CONFIG.logoHeight,
      4,
      4,
    );
    if (CONFIG.logoRotation !== 0) logoGeoBack.rotateZ(-CONFIG.logoRotation);
    logoGeoBack.rotateY(Math.PI);
    logoGeoBack.translate(0, -halfHeight + CONFIG.logoOffsetY, 0);
    logoGeoBack.translate(CONFIG.distanceFromPole, 0, -0.015);

    const map = this._createBannerTexture(textureUrl);

    const logoMat = new THREE.MeshStandardMaterial({
      map: map,
      transparent: true,
      alphaTest: 0.05,
      side: THREE.FrontSide,
      roughness: 0.3,
      metalness: 0.05,
      // Subtle emissive boost keeps logos vivid and legible under all lighting & shadows
      emissive: new THREE.Color(0xffffff),
      emissiveMap: map,
      emissiveIntensity: 0.35,
    });

    if (!this.bannerTimeUniform) this.bannerTimeUniform = { value: 0 };

    const applyWindShader = (shader) => {
      shader.uniforms.uTime = this.bannerTimeUniform;
      shader.vertexShader = `uniform float uTime;\n${shader.vertexShader}`;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `
        #include <begin_vertex>
        float height = ${CONFIG.fabricHeight.toFixed(4)};
        float peak = -(height * 0.5) * (height * 0.5);
        float swayFactor = (position.y * (position.y + height)) / peak;
        float windWave = sin(uTime * 3.0 + position.y * 2.0) * 0.15;
        if (swayFactor > 0.0) { transformed.z += windWave * swayFactor; }
        `,
      );
    };

    fabricMat.onBeforeCompile = applyWindShader;
    logoMat.onBeforeCompile = applyWindShader;

    const variant = {
      parts: [
        {
          geometry: bracketGeo,
          material: bracketMat,
          matrix: new THREE.Matrix4(),
        },
        {
          geometry: bracketGeo,
          material: bracketMat,
          matrix: new THREE.Matrix4().makeTranslation(
            0,
            -CONFIG.fabricHeight,
            0,
          ),
        },
        {
          geometry: fabricGeo,
          material: fabricMat,
          matrix: new THREE.Matrix4(),
        },
        {
          geometry: logoGeoFront,
          material: logoMat,
          matrix: new THREE.Matrix4(),
        },
        {
          geometry: logoGeoBack,
          material: logoMat,
          matrix: new THREE.Matrix4(),
        },
      ],
    };

    this._allocPool(poolName, variant, n);
  }

  // Called once Engine.js's asset loading has resolved. Builds every
  // InstancedMesh pool, sized for `chunkCount` chunks' worth of slots.
  build(models) {
    const n = this.chunkCount;

    // Track surface (always present, every chunk).
    this._allocPool(
      "trackBase",
      {
        parts: [
          {
            geometry: this.trackBuilder.trackBaseGeo,
            material: this.trackBuilder.gravelBaseMat,
            matrix: new THREE.Matrix4(),
          },
        ],
      },
      n,
    );
    this._allocPool(
      "lane",
      {
        parts: [
          {
            geometry: this.trackBuilder.laneGeo,
            material: this.trackBuilder.laneMat,
            matrix: new THREE.Matrix4(),
          },
        ],
      },
      n * 3,
    );
    this._allocPool(
      "trim",
      {
        parts: [
          {
            geometry: this.trackBuilder.trimGeo,
            material: this.trackBuilder.trimMat,
            matrix: new THREE.Matrix4(),
          },
        ],
      },
      n * 2,
    );
    this._allocPool(
      "sleeper",
      {
        parts: [
          {
            geometry: this.trackBuilder.sleeperGeo,
            material: this.trackBuilder.sleeperMat,
            matrix: new THREE.Matrix4(),
          },
        ],
      },
      n * 18,
    );
    this._allocPool(
      "rail",
      {
        parts: [
          {
            geometry: this.trackBuilder.railGeo,
            material: this.trackBuilder.railMat,
            matrix: new THREE.Matrix4(),
          },
        ],
      },
      n * 6,
    );
    this._allocPool(
      "footpath",
      {
        parts: [
          {
            geometry: this.trackBuilder.footpathGeo,
            material: this.trackBuilder.footpathMat,
            matrix: new THREE.Matrix4(),
          },
        ],
      },
      n * 2,
    );

    const railingVariant = buildVariant(models.railing);
    this.hasRailingModel = !!railingVariant;
    if (this.hasRailingModel) {
      this._allocPool("railing", railingVariant, n * 30);
    } else {
      this._allocPool(
        "border",
        {
          parts: [
            {
              geometry: this.trackBuilder.borderGeo,
              material: this.trackBuilder.borderMat,
              matrix: new THREE.Matrix4(),
            },
          ],
        },
        n * 2,
      );
    }

    const streetlightVariant = buildVariant(models.streetlight);
    this.hasStreetlightModel = !!streetlightVariant;
    if (this.hasStreetlightModel) {
      this._allocPool("streetlight", streetlightVariant, n * 2);
      this._createBannerPool(n, "bannerCyntexa", "/img/cyntexa-badge.svg");
      this._createBannerPool(
        n,
        "bannerChargeon",
        "/img/chargeon-logo-badge.webp",
      );
    }

    this.availableBuildingVariants = BUILDING_VARIANTS.filter(
      (k) => !!models[k],
    );
    this.buildingSizes = {};
    for (const key of this.availableBuildingVariants) {
      const variant = buildBuildingVariant(models[key]);
      if (variant) {
        this._allocPool(
          `building_${key}`,
          variant,
          Math.ceil((n * 2) / this.availableBuildingVariants.length) + 40, // Generous capacity for recycled independent buildings
        );
        this.buildingSizes[key] = variant.size;
      }
    }

    this.availableTreeSpecies = TREE_SPECIES.filter((k) => !!models[k]);
    for (const key of this.availableTreeSpecies) {
      const variant = buildVariant(models[key]);
      if (variant)
        this._allocPool(
          `tree_${key}`,
          variant,
          Math.ceil(
            (n * (TREES_PER_SIDE + FAR_TREES_PER_SIDE) * 2) /
              this.availableTreeSpecies.length,
          ) + 4,
        );
    }

    // Footpath props: cycle through available prop types, 2 per chunk (left+right)
    this.availableFootpathProps = FOOTPATH_PROP_KEYS.filter((k) => !!models[k]);
    for (const key of this.availableFootpathProps) {
      const variant = buildPropVariant(models[key]);
      if (variant) {
        // 2 per chunk (left+right), distributed among all prop types
        const capacity =
          Math.ceil((n * 2) / Math.max(this.availableFootpathProps.length, 1)) +
          2;
        this._allocPool(`prop_${key}`, variant, capacity);
      }
    }

    this.ready = true;
  }

  // Called once per chunk (0..chunkCount-1), at startup only. Establishes
  // this chunk's permanent slot -> instance-index assignments and returns
  // the manifest WorldStreamer stores and passes back into sync()/reroll().
  registerChunkSlots(chunkIndex) {
    const manifest = {
      chunkIndex,
      trackBaseIndex: this._take("trackBase"),
      laneIndices: [this._take("lane"), this._take("lane"), this._take("lane")],
      trimIndices: [this._take("trim"), this._take("trim")],
      sleeperIndices: Array.from({ length: 18 }, () => this._take("sleeper")),
      railIndices: Array.from({ length: 6 }, () => this._take("rail")),
      footpathIndices: [this._take("footpath"), this._take("footpath")],
      railingIndices: this.hasRailingModel
        ? Array.from({ length: 30 }, () => this._take("railing"))
        : [],
      borderIndices: this.hasRailingModel
        ? []
        : [this._take("border"), this._take("border")],
      streetlightIndices: this.hasStreetlightModel
        ? [this._take("streetlight"), this._take("streetlight")]
        : [],
      bannerCyntexaIndex: this.hasStreetlightModel
        ? this._take("bannerCyntexa")
        : null,
      bannerChargeonIndex: this.hasStreetlightModel
        ? this._take("bannerChargeon")
        : null,
      // Footpath prop: one per side, type cycles per chunk
      footpathPropSlots: [],
      treeSlots: [],
      hasScenery: chunkIndex % 2 === 0,
      treeJitter: [],
      chunkIndex: chunkIndex, // Add this so syncChunk can read it
    };

    // Assign one prop per side using round-robin through available prop types
    if (this.availableFootpathProps.length > 0) {
      const leftKey =
        this.availableFootpathProps[
          chunkIndex % this.availableFootpathProps.length
        ];
      const rightKey =
        this.availableFootpathProps[
          (chunkIndex + 1) % this.availableFootpathProps.length
        ];
      if (this.pools[`prop_${leftKey}`]) {
        manifest.footpathPropSlots.push({
          pool: `prop_${leftKey}`,
          index: this._take(`prop_${leftKey}`),
          side: -1,
        });
      }
      if (this.pools[`prop_${rightKey}`]) {
        manifest.footpathPropSlots.push({
          pool: `prop_${rightKey}`,
          index: this._take(`prop_${rightKey}`),
          side: 1,
        });
      }
    }

    // Trees: 6 near-tree pairs (left+right) + 14 far-tree pairs, species
    // assigned round-robin across the flat slot list.
    let speciesCursor = chunkIndex; // stagger the starting species per chunk for variety
    const addTreeSlot = (side, xRange, zRange, isNear) => {
      const species = this.availableTreeSpecies.length
        ? this.availableTreeSpecies[
            speciesCursor % this.availableTreeSpecies.length
          ]
        : null;
      speciesCursor++;
      if (!species) return;
      const poolName = `tree_${species}`;
      manifest.treeSlots.push({
        pool: poolName,
        index: this._take(poolName),
        side,
        xRange,
        zRange,
        isNear,
        naturalHeight: this.pools[poolName].naturalHeight || 1,
      });
      manifest.treeJitter.push({ x: 0, z: 0, rotY: 0, scale: 1 });
    };

    const totalZSpan = (TREES_PER_SIDE - 1) * TREE_Z_SPACING;
    const startZ = -totalZSpan / 2;
    for (let i = 0; i < TREES_PER_SIDE; i++) {
      const exactZ = startZ + i * TREE_Z_SPACING;
      // Place at exact X position (no jitter) and exact Z position
      addTreeSlot(
        "left",
        [-TREE_X_POSITION, -TREE_X_POSITION],
        [exactZ, exactZ],
        true,
      );
      addTreeSlot(
        "right",
        [TREE_X_POSITION, TREE_X_POSITION],
        [exactZ, exactZ],
        true,
      );
    }
    for (let i = 0; i < FAR_TREES_PER_SIDE; i++) {
      addTreeSlot("left", [-75, -35], [-15, 15], false);
      addTreeSlot("right", [35, 75], [-15, 15], false);
    }

    return manifest;
  }

  // Re-rolls everything that's allowed to vary between laps (position
  // jitter within each slot's range, tree scale within its target height
  // range, and the density/visibility flags) without touching any
  // pool/instance-index assignment. Call on chunk recycle.
  //
  // `hasSceneryOverride` (Milestone 5): WorldStreamer now decides this roll
  // itself so scenery density and obstacle/coin density share ONE ramped
  // probability (see DIFFICULTY_RAMP) instead of two independent 50% coin
  // flips that happen to usually agree. Falls back to the original
  // independent roll when omitted, so any other caller keeps working
  // unchanged.
  rerollChunk(manifest, hasSceneryOverride) {
    manifest.hasScenery =
      hasSceneryOverride !== undefined
        ? hasSceneryOverride
        : Math.random() > 0.5;

    manifest.treeSlots.forEach((slot, i) => {
      // Near and far trees use the same target-height range in the
      // original code (spawnTree() applies identical normalization to
      // both) -- there's no near/far distinction to make here.
      const [minH, maxH] = TREE_HEIGHT_RANGE;
      const targetHeight = minH + Math.random() * (maxH - minH);
      const scale =
        slot.naturalHeight > 0 ? targetHeight / slot.naturalHeight : 1;
      manifest.treeJitter[i].x =
        slot.xRange[0] + Math.random() * (slot.xRange[1] - slot.xRange[0]);
      manifest.treeJitter[i].z =
        slot.zRange[0] + Math.random() * (slot.zRange[1] - slot.zRange[0]);
      manifest.treeJitter[i].scale = scale;
    });
  }

  // Called every frame by WorldStreamer to advance and update the independent buildings queue.
  syncBuildings(activeZ, moveDist) {
    if (!this.ready || this.availableBuildingVariants.length === 0) return;

    // 1. Move all buildings forward by moveDist (treadmill effect)
    for (const b of this.activeLeftBuildings) b.z += moveDist;
    for (const b of this.activeRightBuildings) b.z += moveDist;
    this.nextLeftBuildingZ += moveDist;
    this.nextRightBuildingZ += moveDist;

    // 2. Cleanup buildings that are behind the camera (activeZ is just behind the camera)
    const cleanupThreshold = activeZ + 40;

    while (
      this.activeLeftBuildings.length > 0 &&
      this.activeLeftBuildings[0].z > cleanupThreshold
    ) {
      const b = this.activeLeftBuildings.shift();
      this.pools[b.pool].hide(b.index);
    }

    while (
      this.activeRightBuildings.length > 0 &&
      this.activeRightBuildings[0].z > cleanupThreshold
    ) {
      const b = this.activeRightBuildings.shift();
      this.pools[b.pool].hide(b.index);
    }

    // Spawn new buildings if the horizon is less than 400 units away
    const horizonThreshold = activeZ - 1000;

    while (this.nextLeftBuildingZ > horizonThreshold) {
      this._spawnNextBuilding("left");
    }
    while (this.nextRightBuildingZ > horizonThreshold) {
      this._spawnNextBuilding("right");
    }

    // Update transforms
    for (const b of this.activeLeftBuildings) {
      this.pools[b.pool].setTransform(
        b.index,
        composePlacement(b.x, 0, b.z, b.rotY, b.scale),
      );
    }
    for (const b of this.activeRightBuildings) {
      this.pools[b.pool].setTransform(
        b.index,
        composePlacement(b.x, 0, b.z, b.rotY, b.scale),
      );
    }
  }

  _spawnNextBuilding(side) {
    const isLeft = side === "left";
    const block = isLeft ? this.leftBlock : this.rightBlock;

    // If we've finished the previous block of houses, pick a new type!
    if (block.remaining <= 0) {
      let newVariant = block.variant;
      if (this.availableBuildingVariants.length > 1) {
        while (newVariant === block.variant) {
          const randomIndex = Math.floor(
            Math.random() * this.availableBuildingVariants.length,
          );
          newVariant = this.availableBuildingVariants[randomIndex];
        }
      } else {
        newVariant = this.availableBuildingVariants[0];
      }

      block.variant = newVariant;

      if (RARE_BUILDINGS.includes(newVariant)) {
        block.type = "RARE";
        block.remaining = 1;
      } else if (LARGE_BUILDINGS.includes(newVariant)) {
        block.type = "LARGE";
        block.remaining = Math.random() < 0.7 ? 1 : 2; // Mostly 1, sometimes 2
      } else if (COMMERCIAL_BUILDINGS.includes(newVariant)) {
        block.type = "COMMERCIAL";
        block.remaining = Math.floor(Math.random() * 3) + 1; // Mix of 1 to 3 commercial buildings
      } else {
        block.type = "NORMAL";
        block.remaining = Math.floor(Math.random() * 2) + 1; // 1 or 2 normal buildings
      }
    }

    let variant = block.variant;

    // For commercial blocks, we mix them up instead of repeating the same one!
    if (block.type === "COMMERCIAL") {
      let commercialVariant =
        COMMERCIAL_BUILDINGS[
          Math.floor(Math.random() * COMMERCIAL_BUILDINGS.length)
        ];
      // Prevent spawning the exact same commercial building back-to-back
      while (commercialVariant === block.lastVariant) {
        commercialVariant =
          COMMERCIAL_BUILDINGS[
            Math.floor(Math.random() * COMMERCIAL_BUILDINGS.length)
          ];
      }
      variant = commercialVariant;
    }

    block.lastVariant = variant;
    block.remaining--;

    const scale = BUILDING_SCALE[variant] || 1;
    const rotAdj = BUILDING_ROTATION_ADJUSTMENT[variant] || 0;
    const rotY = rotAdj + BUILDING_ROTATION_OFFSET + (isLeft ? 0 : Math.PI);

    // Use the exact native width calculation, but this time we DONT modify the scale!
    // We just read how big it is, so we know exactly where to place the NEXT building!
    const lengthAlongTrack = getBuildingLengthAlongTrack(
      variant,
      rotY,
      scale,
      this.buildingSizes,
    );
    const widthAwayFromTrack = getBuildingDepthAwayFromTrack(
      variant,
      rotY,
      scale,
      this.buildingSizes,
    );

    const xPos = isLeft
      ? -(BUILDING_TRACK_MARGIN + widthAwayFromTrack / 2)
      : BUILDING_TRACK_MARGIN + widthAwayFromTrack / 2;

    // Z position is at the center of the building footprint
    // Since Z goes negatively, we subtract half the length to get the center
    const zPos =
      (isLeft ? this.nextLeftBuildingZ : this.nextRightBuildingZ) -
      lengthAlongTrack / 2;

    // Reserve an index from the pool
    const poolName = `building_${variant}`;
    const instanceIndex = this._take(poolName);

    const buildingRecord = {
      pool: poolName,
      index: instanceIndex,
      x: xPos,
      z: zPos,
      rotY: rotY,
      scale: scale,
    };

    if (isLeft) {
      this.activeLeftBuildings.push(buildingRecord);
      this.nextLeftBuildingZ -= lengthAlongTrack + 5; // 5-unit gap after this building
    } else {
      this.activeRightBuildings.push(buildingRecord);
      this.nextRightBuildingZ -= lengthAlongTrack + 5; // 5-unit gap after this building
    }
  }

  // Called every frame for every chunk: writes fresh world matrices for
  // every slot this chunk owns, based on its current Z position. This is
  // the only per-frame cost -- pure Matrix4 composition into pre-allocated
  // buffers, no allocation.
  syncChunk(manifest, chunkZ) {
    if (this.bannerTimeUniform) {
      this.bannerTimeUniform.value = performance.now() / 1000;
    }

    // 1. Base Gravel/Dirt ground (Subway Surfers ground)
    this.pools.trackBase.setTransform(
      manifest.trackBaseIndex,
      composePlacement(0, 0.01, chunkZ, 0, 1),
    );

    // Hide old asphalt road lanes & yellow road markings so they don't cover the railway tracks
    manifest.laneIndices.forEach((idx) => this.pools.lane.hide(idx));
    manifest.trimIndices.forEach((idx) => this.pools.trim.hide(idx));

    // 2. Subway Surfers Metallic Steel Rails (2 rails per lane = 6 total rails)
    const laneX = this.trackBuilder.laneX;
    manifest.railIndices.forEach((idx, i) => {
      const lane = Math.floor(i / 2);
      const sideOffset = i % 2 === 0 ? -0.8 : 0.8;
      const railX = laneX[lane] + sideOffset;
      this.pools.rail.setTransform(
        idx,
        composePlacement(railX, 0.15, chunkZ, 0, 1),
      );
    });

    // 3. Subway Surfers Wooden Sleepers / Planks (6 sleepers per lane = 18 total per chunk)
    manifest.sleeperIndices.forEach((idx, i) => {
      const lane = Math.floor(i / 6);
      const stepIndex = i % 6;
      const zLocal = stepIndex * 3.33 - 8.33;
      const sleeperX = laneX[lane];
      this.pools.sleeper.setTransform(
        idx,
        composePlacement(sleeperX, 0.05, chunkZ + zLocal, 0, 1),
      );
    });

    manifest.footpathIndices.forEach((idx, i) => {
      const side = i === 0 ? -1 : 1;
      this.pools.footpath.setTransform(
        idx,
        composePlacement(side * 7.85, 0.2, chunkZ, 0, 1),
      );
    });

    manifest.railingIndices.forEach((idx, i) => {
      const side = i < 15 ? -1 : 1;
      const r = i % 15;
      const zLocal = r * 2 - 14;
      this.pools.railing.setTransform(
        idx,
        composePlacement(
          side * 4.8,
          -0.25,
          chunkZ + zLocal,
          side > 0 ? -Math.PI / 2 : Math.PI / 2,
          1,
        ),
      );
    });

    manifest.borderIndices.forEach((idx, i) => {
      const x = i === 0 ? -5 : 5;
      this.pools.border.setTransform(
        idx,
        composePlacement(x, -0.1, chunkZ, 0, 1),
      );
    });

    manifest.streetlightIndices.forEach((idx, i) => {
      // Space them out by only showing them on even chunks (every 60 units instead of 30)
      if (manifest.chunkIndex % 2 !== 0) {
        this.pools.streetlight.hide(idx);
        return;
      }

      // The pole base is locally offset by ~1.0 in +X. With scale 1.5, that's +1.5 world offset.
      // To place the pole at +/- 4.9, we need x = 4.9 - 1.5 = 3.4.
      const x = i === 0 ? -4.9 : 4.9;
      const rotY = i === 0 ? Math.PI : 0;
      this.pools.streetlight.setTransform(
        idx,
        composePlacement(x, 0, chunkZ, rotY, 1),
      );
    });

    if (this.hasStreetlightModel) {
      if (manifest.chunkIndex % 2 === 0) {
        // Place banners exactly at the top of the streetlight poles based on configured height
        // Left side pole gets Cyntexa badge (rotated so it faces track)
        this.pools.bannerCyntexa.setTransform(
          manifest.bannerCyntexaIndex,
          composePlacement(-4.9, this.bannerMountHeight, chunkZ, Math.PI, 1),
        );
        // Right side pole gets ChargeOn badge
        this.pools.bannerChargeon.setTransform(
          manifest.bannerChargeonIndex,
          composePlacement(4.9, this.bannerMountHeight, chunkZ, 0, 1),
        );
      } else {
        // Hide banners on chunks where streetlights are also hidden
        this.pools.bannerCyntexa.hide(manifest.bannerCyntexaIndex);
        this.pools.bannerChargeon.hide(manifest.bannerChargeonIndex);
      }
    }

    manifest.treeSlots.forEach((slot, i) => {
      const jitter = manifest.treeJitter[i];
      const visible = manifest.hasScenery;
      const pool = this.pools[slot.pool];
      if (!visible) {
        pool.hide(slot.index);
        return;
      }
      pool.setTransform(
        slot.index,
        composePlacement(
          jitter.x,
          TREE_Y_POSITION, // Up/down position based on configuration
          chunkZ + jitter.z,
          jitter.rotY,
          jitter.scale,
          TREE_WIDTH_MULTIPLIER, // Custom width multiplier!
        ),
      );
    });

    // Footpath props: place on sidewalk surface (y=0.6 = top of footpath box)
    // x=±9 puts them just inside the footpath width, visible next to the railing
    manifest.footpathPropSlots.forEach((slot) => {
      const pool = this.pools[slot.pool];
      if (!pool) return;
      // Place prop at sidewalk level, slightly offset into the footpath
      const propX = slot.side * 9.0;
      // Face the track: right side (-Math.PI/2), left side (Math.PI/2)
      pool.setTransform(
        slot.index,
        composePlacement(
          propX,
          0.6,
          chunkZ,
          slot.side > 0 ? -Math.PI / 2 : Math.PI / 2,
          1,
        ),
      );
    });
  }

  // Call once per frame after every chunk has been synced.
  flush() {
    for (const name in this.pools) this.pools[name].flush();
  }

  dispose() {
    for (const name in this.pools) this.pools[name].dispose();
    this.pools = {};
  }
}
