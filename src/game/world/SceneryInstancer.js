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

const NEAR_TREES_PER_SIDE = 6; // fixed from the original 4-7 random range
const FAR_TREES_PER_SIDE = 14; // fixed from the original 10-18 random range
const TREE_SPECIES = ["maple", "poplar", "whitePoplar"];
const BUILDING_VARIANTS = ["build1", "build2", "build3", "house1"];
const BUILDING_SCALE = { build1: 3, build2: 3, build3: 3, house1: 12 };

const TREE_HEIGHT_RANGE = [15, 25]; // matches the original spawnTree height normalization

const _m1 = new THREE.Matrix4();
const _m2 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0); // degenerate: renders nothing

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
  lod0.geometry.boundingBox.getCenter(center);
  center.applyMatrix4(lod0.matrix);

  const centering = new THREE.Matrix4().makeTranslation(-center.x, 0, -center.z);
  const canonical = new THREE.Matrix4().multiplyMatrices(centering, lod0.matrix);

  return { parts: [{ geometry: lod0.geometry, material: lod0.material, matrix: canonical }] };
}

// One InstancedMesh per (variant, part). Instance transforms are written
// directly via setMatrixAt -- no allocation after construction.
class InstancePool {
  constructor(scene, geometry, material, capacity) {
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
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
    if (Array.isArray(this.mesh.material)) this.mesh.material.forEach((m) => m.dispose());
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
function composePlacement(x, y, z, rotY, scale) {
  _pos.set(x, y, z);
  _quat.setFromAxisAngle(_UP, rotY);
  _scale.set(scale, scale, scale);
  return _m2.compose(_pos, _quat, _scale);
}
const _UP = new THREE.Vector3(0, 1, 0);

export class SceneryInstancer {
  constructor(scene, chunkCount, trackBuilder) {
    this.scene = scene;
    this.chunkCount = chunkCount;
    this.trackBuilder = trackBuilder;
    this.pools = {}; // name -> MultiPartPool
    this.ready = false;
    this._nextIndex = {}; // name -> next free instance index (fixed allocation, never freed)
  }

  _allocPool(name, variantData, capacity) {
    this.pools[name] = new MultiPartPool(this.scene, variantData, capacity);
    this._nextIndex[name] = 0;
  }

  _take(name) {
    const idx = this._nextIndex[name]++;
    if (idx >= this.pools[name].parts[0].mesh.count) {
      throw new Error(`SceneryInstancer: pool "${name}" exceeded its capacity`);
    }
    return idx;
  }

  // Called once Engine.js's asset loading has resolved. Builds every
  // InstancedMesh pool, sized for `chunkCount` chunks' worth of slots.
  build(models) {
    const n = this.chunkCount;

    // Track surface (always present, every chunk).
    this._allocPool(
      "trackBase",
      { parts: [{ geometry: this.trackBuilder.trackBaseGeo, material: this.trackBuilder.trackBaseMat, matrix: new THREE.Matrix4() }] },
      n,
    );
    this._allocPool(
      "lane",
      { parts: [{ geometry: this.trackBuilder.laneGeo, material: this.trackBuilder.laneMat, matrix: new THREE.Matrix4() }] },
      n * 3,
    );
    this._allocPool(
      "trim",
      { parts: [{ geometry: this.trackBuilder.trimGeo, material: this.trackBuilder.trimMat, matrix: new THREE.Matrix4() }] },
      n * 2,
    );

    const railingVariant = buildVariant(models.railing);
    this.hasRailingModel = !!railingVariant;
    if (this.hasRailingModel) {
      this._allocPool("railing", railingVariant, n * 30);
    } else {
      this._allocPool(
        "border",
        { parts: [{ geometry: this.trackBuilder.borderGeo, material: this.trackBuilder.borderMat, matrix: new THREE.Matrix4() }] },
        n * 2,
      );
    }

    const streetlightVariant = buildVariant(models.streetlight);
    this.hasStreetlightModel = !!streetlightVariant;
    if (this.hasStreetlightModel) {
      this._allocPool("streetlight", streetlightVariant, n * 2);
    }

    this.availableBuildingVariants = BUILDING_VARIANTS.filter((k) => !!models[k]);
    for (const key of this.availableBuildingVariants) {
      const variant = buildBuildingVariant(models[key]);
      if (variant) this._allocPool(`building_${key}`, variant, Math.ceil((n * 2) / this.availableBuildingVariants.length) + 2);
    }

    this.availableTreeSpecies = TREE_SPECIES.filter((k) => !!models[k]);
    for (const key of this.availableTreeSpecies) {
      const variant = buildVariant(models[key]);
      if (variant) this._allocPool(`tree_${key}`, variant, Math.ceil(((n * (NEAR_TREES_PER_SIDE + FAR_TREES_PER_SIDE) * 2)) / this.availableTreeSpecies.length) + 4);
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
      railingIndices: this.hasRailingModel ? Array.from({ length: 30 }, () => this._take("railing")) : [],
      borderIndices: this.hasRailingModel ? [] : [this._take("border"), this._take("border")],
      streetlightIndices: this.hasStreetlightModel ? [this._take("streetlight"), this._take("streetlight")] : [],
      treeSlots: [],
      buildingSlots: [],
      hasScenery: chunkIndex % 2 === 0, // matches the original ~50% density pacing
      buildingVisible: [false, false],
      buildingZJitter: [0, 0],
      treeJitter: [],
    };

    // Trees: 6 near-tree pairs (left+right) + 14 far-tree pairs, species
    // assigned round-robin across the flat slot list.
    let speciesCursor = chunkIndex; // stagger the starting species per chunk for variety
    const addTreeSlot = (side, xRange, zRange, isNear) => {
      const species = this.availableTreeSpecies.length
        ? this.availableTreeSpecies[speciesCursor % this.availableTreeSpecies.length]
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

    for (let i = 0; i < NEAR_TREES_PER_SIDE; i++) {
      addTreeSlot("left", [-14, -6], [-15, 15], true);
      addTreeSlot("right", [6, 14], [-15, 15], true);
    }
    for (let i = 0; i < FAR_TREES_PER_SIDE; i++) {
      addTreeSlot("left", [-75, -35], [-15, 15], false);
      addTreeSlot("right", [35, 75], [-15, 15], false);
    }

    // Buildings: one left slot, one right slot, fixed variant per slot
    // (round robin), independent 70%-visible roll re-decided each recycle
    // (matches the original Math.random() > 0.3 per side).
    if (this.availableBuildingVariants.length > 0) {
      const leftVariant = this.availableBuildingVariants[chunkIndex % this.availableBuildingVariants.length];
      const rightVariant =
        this.availableBuildingVariants[(chunkIndex + 2) % this.availableBuildingVariants.length];
      manifest.buildingSlots.push({
        pool: `building_${leftVariant}`,
        index: this._take(`building_${leftVariant}`),
        side: "left",
        baseX: -30,
        zRange: [-7.5, 7.5],
        rotY: 0,
        scale: BUILDING_SCALE[leftVariant],
      });
      manifest.buildingSlots.push({
        pool: `building_${rightVariant}`,
        index: this._take(`building_${rightVariant}`),
        side: "right",
        baseX: 30,
        zRange: [-7.5, 7.5],
        rotY: Math.PI,
        scale: BUILDING_SCALE[rightVariant],
      });
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
    manifest.hasScenery = hasSceneryOverride !== undefined ? hasSceneryOverride : Math.random() > 0.5;

    manifest.treeSlots.forEach((slot, i) => {
      // Near and far trees use the same target-height range in the
      // original code (spawnTree() applies identical normalization to
      // both) -- there's no near/far distinction to make here.
      const [minH, maxH] = TREE_HEIGHT_RANGE;
      const targetHeight = minH + Math.random() * (maxH - minH);
      const scale = slot.naturalHeight > 0 ? targetHeight / slot.naturalHeight : 1;
      manifest.treeJitter[i].x = slot.xRange[0] + Math.random() * (slot.xRange[1] - slot.xRange[0]);
      manifest.treeJitter[i].z = slot.zRange[0] + Math.random() * (slot.zRange[1] - slot.zRange[0]);
      manifest.treeJitter[i].scale = scale;
    });

    manifest.buildingSlots.forEach((slot, i) => {
      manifest.buildingVisible[i] = Math.random() > 0.3;
      manifest.buildingZJitter[i] = slot.zRange[0] + Math.random() * (slot.zRange[1] - slot.zRange[0]);
    });
  }

  // Called every frame for every chunk: writes fresh world matrices for
  // every slot this chunk owns, based on its current Z position. This is
  // the only per-frame cost -- pure Matrix4 composition into pre-allocated
  // buffers, no allocation.
  syncChunk(manifest, chunkZ) {
    this.pools.trackBase.setTransform(manifest.trackBaseIndex, composePlacement(0, -0.25, chunkZ, 0, 1));

    const laneX = this.trackBuilder.laneX;
    manifest.laneIndices.forEach((idx, i) => {
      this.pools.lane.setTransform(idx, composePlacement(laneX[i], -0.2, chunkZ, 0, 1));
    });

    const trimX = this.trackBuilder.trimX;
    manifest.trimIndices.forEach((idx, i) => {
      this.pools.trim.setTransform(idx, composePlacement(trimX[i], -0.2, chunkZ, 0, 1));
    });

    manifest.railingIndices.forEach((idx, i) => {
      const side = i < 15 ? -1 : 1;
      const r = i % 15;
      const zLocal = r * 2 - 14;
      this.pools.railing.setTransform(idx, composePlacement(side * 4.8, -0.25, chunkZ + zLocal, side > 0 ? -Math.PI / 2 : Math.PI / 2, 1));
    });

    manifest.borderIndices.forEach((idx, i) => {
      const x = i === 0 ? -5 : 5;
      this.pools.border.setTransform(idx, composePlacement(x, -0.1, chunkZ, 0, 1));
    });

    manifest.streetlightIndices.forEach((idx, i) => {
      const x = i === 0 ? -5.5 : 5.5;
      const rotY = i === 0 ? Math.PI : 0;
      this.pools.streetlight.setTransform(idx, composePlacement(x, 0, chunkZ, rotY, 1.5));
    });

    manifest.treeSlots.forEach((slot, i) => {
      const jitter = manifest.treeJitter[i];
      const visible = manifest.hasScenery;
      const pool = this.pools[slot.pool];
      if (!visible) {
        pool.hide(slot.index);
        return;
      }
      pool.setTransform(slot.index, composePlacement(jitter.x, 0, chunkZ + jitter.z, jitter.rotY, jitter.scale));
    });

    manifest.buildingSlots.forEach((slot, i) => {
      const visible = manifest.hasScenery && manifest.buildingVisible[i];
      const pool = this.pools[slot.pool];
      if (!visible) {
        pool.hide(slot.index);
        return;
      }
      pool.setTransform(
        slot.index,
        composePlacement(slot.baseX, 0, chunkZ + manifest.buildingZJitter[i], slot.rotY, slot.scale),
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
