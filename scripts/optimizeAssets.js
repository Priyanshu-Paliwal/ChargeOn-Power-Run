#!/usr/bin/env node
// Regenerates public/assets/** and public/textures/grass_normal.jpg from assets-src/**.
// Originals in assets-src/ are never modified. Safe to re-run at any time —
// output is always rebuilt fresh from source, so this script is the single
// source of truth for what ships in public/.

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  dedup,
  flatten,
  join,
  weld,
  simplify,
  prune,
  textureCompress,
  draco,
  normals,
  compactPrimitive,
  getSceneVertexCount,
  VertexCountMethod,
} from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
import draco3d from "draco3dgltf";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "assets-src");
const PUBLIC = path.join(ROOT, "public");
const OUT_ASSETS = path.join(PUBLIC, "assets");

// ---------------------------------------------------------------------------
// GLB jobs. Each one reads assets-src/<src>, writes public/assets/<out>.
//
// pipeline:
//   'heavy'        — flatten + join + weld + simplify (scan-grade / huge
//                    assets whose geometry is a single connected surface)
//   'heavy-sloppy' — flatten + join + weld, then meshoptimizer's
//                    simplifySloppy() called directly on raw position/index
//                    buffers instead of the attribute-aware simplify().
//                    Desert_field.glb's "10,664 nodes" turned out, after
//                    join(), to be ~126M genuinely unique vertices split
//                    across 900+ disconnected geometry islands (confirmed
//                    via union-find over the index buffer) -- typical of a
//                    raw photogrammetry/scan export that was never merged
//                    into one manifold surface. The standard simplify()
//                    respects per-island topological borders and plateaued
//                    at ~40% reduction no matter how loose its error/ratio
//                    was set (tested 0.02 through 1.0 -- no meaningful
//                    difference), because border-locking isn't governed by
//                    that budget. simplifySloppy() has no concept of
//                    "island borders" to protect, so it isn't blocked by
//                    this and can hit an arbitrary target triangle count
//                    directly -- appropriate here since this asset is only
//                    ever seen as a distant, unlit background layer at 0.015
//                    world scale (see Engine.js).
//   'light'        — weld only, no join/simplify (already-reasonable assets)
//   'minimal'      — dedup + prune only, nothing that could rename/merge
//                    nodes (StreetLightPoles.glb has a child named
//                    'Single_arm' that Engine.js looks up by name --
//                    join()/flatten() must never touch this file)
// ---------------------------------------------------------------------------
const GLB_JOBS = [
  {
    name: "Desert_field.glb",
    src: "models/environment/Desert_field.glb",
    out: "models/environment/Desert_field.glb",
    pipeline: "heavy-sloppy",
    targetTris: 60000, // distributed across primitives by their share of total tris
    textureResize: [1024, 1024],
    textureQuality: 75,
    limitInputPixels: false, // source has an embedded 12000x12000 texture
    targetBytes: 3 * 1024 * 1024,
  },
  {
    name: "MetalRailing.glb",
    src: "models/environment/MetalRailing.glb",
    out: "models/environment/MetalRailing.glb",
    pipeline: "heavy",
    simplify: { ratio: 0.03, error: 0.02 },
    textureResize: [512, 512],
    textureQuality: 78,
    targetBytes: 150 * 1024,
  },
  {
    name: "poplar1.glb",
    src: "models/trees/poplar1.glb",
    out: "models/trees/poplar1.glb",
    pipeline: "heavy",
    simplify: { ratio: 0.4, error: 0.01 },
    textureResize: [1024, 1024],
    textureQuality: 78,
    targetBytes: 250 * 1024,
  },
  {
    name: "maple1.glb",
    src: "models/trees/maple1.glb",
    out: "models/trees/maple1.glb",
    pipeline: "heavy",
    simplify: { ratio: 0.4, error: 0.01 },
    textureResize: [1024, 1024],
    textureQuality: 78,
    targetBytes: 250 * 1024,
  },
  {
    name: "whitePoplar1.glb",
    src: "models/trees/whitePoplar1.glb",
    out: "models/trees/whitePoplar1.glb",
    pipeline: "heavy",
    simplify: { ratio: 0.5, error: 0.01 },
    textureResize: [1024, 1024],
    textureQuality: 78,
    targetBytes: 250 * 1024,
  },
  {
    name: "old_small_house.glb",
    src: "models/buildings/old_small_house.glb",
    out: "models/buildings/old_small_house.glb",
    pipeline: "heavy",
    simplify: { ratio: 0.35, error: 0.005 },
    textureResize: [1024, 1024],
    textureQuality: 80,
    targetBytes: 400 * 1024,
  },
  {
    name: "L_build_1.glb",
    src: "models/buildings/L_build_1.glb",
    out: "models/buildings/L_build_1.glb",
    pipeline: "light",
    targetBytes: 200 * 1024,
  },
  {
    name: "L_build_2.glb",
    src: "models/buildings/L_build_2.glb",
    out: "models/buildings/L_build_2.glb",
    pipeline: "light",
    targetBytes: 200 * 1024,
  },
  {
    name: "L_build_3.glb",
    src: "models/buildings/L_build_3.glb",
    out: "models/buildings/L_build_3.glb",
    pipeline: "light",
    targetBytes: 200 * 1024,
  },
  {
    name: "StreetLightPoles.glb",
    src: "models/environment/StreetLightPoles.glb",
    out: "models/environment/StreetLightPoles.glb",
    pipeline: "minimal",
    targetBytes: 500 * 1024,
  },
];

// ---------------------------------------------------------------------------
// Standalone building textures (loaded directly via THREE.TextureLoader in
// Engine.js's loadBuilding(), not embedded in a glTF document). PNG -> WebP.
// Engine.js's texture path template was updated to request .webp to match.
// ---------------------------------------------------------------------------
const TEXTURE_JOBS = [
  { file: "L1_Base_Color", quality: 82 },
  { file: "L1_Normal", quality: 85 },
  { file: "L1_Roughness", quality: 75 },
  { file: "L2_Base_Color", quality: 82 },
  { file: "L2_Normal", quality: 85 },
  { file: "L2_Roughness", quality: 75 },
  { file: "L3_Base_Color", quality: 82 },
  { file: "L3_Normal", quality: 85 },
  { file: "L3_Roughness", quality: 75 },
].map((t) => ({
  src: `textures/buildings/${t.file}.png`,
  out: `textures/buildings/${t.file}.webp`,
  quality: t.quality,
}));

function fmtBytes(n) {
  if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(2) + " MB";
  return (n / 1024).toFixed(1) + " KB";
}

async function processGlb(io, job) {
  const inPath = path.join(SRC, job.src);
  const outPath = path.join(OUT_ASSETS, job.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const beforeBytes = fs.statSync(inPath).size;
  const doc = await io.read(inPath);
  const root = doc.getRoot();

  if (job.pipeline === "heavy-sloppy") {
    // flatten+join+weld first, exactly like 'heavy' -- this is still the
    // right way to collapse the node/mesh count. It just can't be followed
    // by the attribute-aware simplify() on this particular asset.
    await doc.transform(dedup(), flatten(), join({ keepNamed: false }), weld());

    let totalTrisBefore = 0;
    for (const mesh of root.listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        totalTrisBefore += prim.getIndices().getCount() / 3;
      }
    }

    for (const mesh of root.listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const posAttr = prim.getAttribute("POSITION");
        const positions = posAttr.getArray();
        const indicesAcc = prim.getIndices();
        const srcIndices = indicesAcc.getArray();
        const indices =
          srcIndices instanceof Uint32Array ? srcIndices : Uint32Array.from(srcIndices);

        const triShare = indices.length / 3 / totalTrisBefore;
        const targetTris = Math.max(8, Math.round(job.targetTris * triShare));

        const [newIndices] = MeshoptSimplifier.simplifySloppy(
          indices,
          positions,
          3,
          null,
          targetTris * 3,
          1.0,
        );
        indicesAcc.setArray(newIndices);
        prim.setAttribute("NORMAL", null); // stale post-decimation; regenerated below
        compactPrimitive(prim);
      }
    }

    await doc.transform(prune(), normals());
  } else {
    const transforms = [dedup()];

    if (job.pipeline === "heavy") {
      transforms.push(flatten(), join({ keepNamed: false }), weld());
      if (job.simplify) {
        transforms.push(
          simplify({ simplifier: MeshoptSimplifier, lockBorder: true, ...job.simplify }),
        );
      }
    } else if (job.pipeline === "light") {
      transforms.push(weld());
    }
    // 'minimal' -> only dedup, no weld/join/simplify: preserves node names
    // and hierarchy exactly (StreetLightPoles.glb's 'Single_arm' child).

    transforms.push(prune());
    await doc.transform(...transforms);
  }

  if (job.textureResize || job.textureQuality) {
    await doc.transform(
      textureCompress({
        encoder: sharp,
        targetFormat: "webp",
        resize: job.textureResize,
        quality: job.textureQuality ?? 80,
        limitInputPixels: job.limitInputPixels ?? true,
      }),
    );
  }

  await doc.transform(draco({ method: "edgebreaker" }));
  await io.write(outPath, doc);

  const afterBytes = fs.statSync(outPath).size;

  // Sanity re-read: confirm the written file is valid glTF, not corrupted.
  const check = await io.read(outPath);
  let verts = 0;
  for (const scene of check.getRoot().listScenes()) {
    verts += getSceneVertexCount(scene, VertexCountMethod.RENDER);
  }

  return {
    name: job.name,
    beforeBytes,
    afterBytes,
    targetBytes: job.targetBytes,
    verts,
    ok: verts > 0,
  };
}

async function processTexture(job) {
  const inPath = path.join(SRC, job.src);
  const outPath = path.join(OUT_ASSETS, job.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const beforeBytes = fs.statSync(inPath).size;
  await sharp(inPath).webp({ quality: job.quality }).toFile(outPath);
  const afterBytes = fs.statSync(outPath).size;

  // Sanity check: confirm the output decodes and has sane dimensions.
  const meta = await sharp(outPath).metadata();

  return {
    name: path.basename(job.out),
    beforeBytes,
    afterBytes,
    ok: meta.width > 0 && meta.height > 0,
  };
}

// ---------------------------------------------------------------------------
// Deterministic seeded value noise -> tangent-space normal map. Originally
// written to replace the broken public/textures/grass_normal.jpg (was 14
// bytes containing the literal text "404: Not Found" -- see
// docs/IMPLEMENTATION_PLAN.md); now shared by asphalt_normal.jpg too (see
// below) via the `octaves`/`strength` params, since both are "a subtle,
// tileable bump field," just at different scales. Fixed seed so
// `npm run assets:optimize` is fully reproducible.
// ---------------------------------------------------------------------------
function generateNoiseNormalMap(outPath, { size = 512, seed = 1337, octaves: octaveDefs, strength = 2.2 } = {}) {
  // Small deterministic PRNG (mulberry32) so output is identical every run.
  let s = seed >>> 0;
  const rand = () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // A handful of random gradient octaves, each tiled to an integer number of
  // periods across the image so the result wraps seamlessly at the edges.
  const octaves = octaveDefs.map((o) => ({
    ...o,
    phaseX: rand() * Math.PI * 2,
    phaseY: rand() * Math.PI * 2,
    phaseX2: rand() * Math.PI * 2,
    phaseY2: rand() * Math.PI * 2,
  }));

  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let h = 0;
      for (const o of octaves) {
        const u = (x / size) * Math.PI * 2 * o.periods;
        const v = (y / size) * Math.PI * 2 * o.periods;
        // Sum of seamless sinusoids (each an integer number of periods)
        // gives a tileable, non-trivial bump field without needing a
        // wrapped-coordinate noise lattice.
        h +=
          o.amp *
          (Math.sin(u + o.phaseX) * Math.cos(v + o.phaseY) +
            0.5 * Math.sin(u * 2 + o.phaseX2) * Math.cos(v * 2 + o.phaseY2));
      }
      height[y * size + x] = h;
    }
  }

  // Sobel-ish gradient -> tangent-space normal (Y-up convention: R=X, G=Y, B=Z)
  const pixels = Buffer.alloc(size * size * 3);
  const at = (x, y) => height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      let nx = -dx, ny = -dy, nz = 1.0;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx /= len; ny /= len; nz /= len;
      const i = (y * size + x) * 3;
      pixels[i] = Math.round((nx * 0.5 + 0.5) * 255);
      pixels[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      pixels[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
    }
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  return sharp(pixels, { raw: { width: size, height: size, channels: 3 } })
    .jpeg({ quality: 90 })
    .toFile(outPath);
}

function generateGrassNormalMap(outPath, size = 512, seed = 1337) {
  return generateNoiseNormalMap(outPath, {
    size,
    seed,
    strength: 2.2, // grass should read as subtle, not spiky
    octaves: [
      { periods: 6, amp: 1.0 },
      { periods: 13, amp: 0.5 },
      { periods: 27, amp: 0.25 },
      { periods: 53, amp: 0.12 },
    ],
  });
}

// Replaces public/textures/asphalt_normal.jpg, which downloadAssets.js used
// to source from three.js's own examples/textures/waternormals.jpg (a
// literal water-ripple normal map, per that script's own since-removed
// comment "we'll tile this heavily for road grit") -- a directional,
// flowing ripple pattern reads as WATER regardless of how it's tiled or
// what material properties sit on top of it, which is exactly the "shiny
// wet road" look flagged during manual playtesting. Much higher spatial
// frequency (period counts 40-160 vs grass's 6-53) and lower strength than
// grass_normal.jpg: real asphalt grain is fine and directionless, not a
// few big rolling bumps.
function generateAsphaltNormalMap(outPath, size = 512, seed = 4242) {
  return generateNoiseNormalMap(outPath, {
    size,
    seed,
    strength: 1.1,
    octaves: [
      { periods: 40, amp: 1.0 },
      { periods: 90, amp: 0.6 },
      { periods: 160, amp: 0.3 },
    ],
  });
}

async function main() {
  console.log("ChargeOn Power Run — asset optimization pipeline\n");

  await MeshoptSimplifier.ready;
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      "draco3d.decoder": await draco3d.createDecoderModule(),
      "draco3d.encoder": await draco3d.createEncoderModule(),
    });

  const results = [];
  let anyFailed = false;

  for (const job of GLB_JOBS) {
    process.stdout.write(`  ${job.name} ... `);
    try {
      const r = await processGlb(io, job);
      results.push(r);
      const overTarget = r.targetBytes && r.afterBytes > r.targetBytes;
      console.log(
        `${fmtBytes(r.beforeBytes)} -> ${fmtBytes(r.afterBytes)}` +
          (overTarget ? `  [OVER TARGET ${fmtBytes(r.targetBytes)}]` : ""),
      );
      if (!r.ok) {
        anyFailed = true;
        console.error(`    ERROR: re-read of ${job.name} produced no geometry`);
      }
    } catch (err) {
      anyFailed = true;
      console.error(`FAILED\n    ${err.message}`);
    }
  }

  for (const job of TEXTURE_JOBS) {
    process.stdout.write(`  ${job.out} ... `);
    try {
      const r = await processTexture(job);
      results.push(r);
      console.log(`${fmtBytes(r.beforeBytes)} -> ${fmtBytes(r.afterBytes)}`);
      if (!r.ok) {
        anyFailed = true;
        console.error(`    ERROR: ${job.out} failed to decode after write`);
      }
    } catch (err) {
      anyFailed = true;
      console.error(`FAILED\n    ${err.message}`);
    }
  }

  process.stdout.write(`  textures/grass_normal.jpg (procedural, replaces broken file) ... `);
  try {
    const outPath = path.join(PUBLIC, "textures", "grass_normal.jpg");
    await generateGrassNormalMap(outPath);
    const size = fs.statSync(outPath).size;
    console.log(`generated, ${fmtBytes(size)}`);
    const meta = await sharp(outPath).metadata();
    if (!(meta.width > 0 && meta.height > 0)) {
      anyFailed = true;
      console.error("    ERROR: generated grass_normal.jpg failed to decode");
    }
  } catch (err) {
    anyFailed = true;
    console.error(`FAILED\n    ${err.message}`);
  }

  process.stdout.write(`  textures/asphalt_normal.jpg (procedural, replaces the water-ripple texture) ... `);
  try {
    const outPath = path.join(PUBLIC, "textures", "asphalt_normal.jpg");
    await generateAsphaltNormalMap(outPath);
    const size = fs.statSync(outPath).size;
    console.log(`generated, ${fmtBytes(size)}`);
    const meta = await sharp(outPath).metadata();
    if (!(meta.width > 0 && meta.height > 0)) {
      anyFailed = true;
      console.error("    ERROR: generated asphalt_normal.jpg failed to decode");
    }
  } catch (err) {
    anyFailed = true;
    console.error(`FAILED\n    ${err.message}`);
  }

  const totalBefore = results.reduce((a, r) => a + r.beforeBytes, 0);
  const totalAfter = results.reduce((a, r) => a + r.afterBytes, 0);
  console.log(
    `\nTotal (processed assets only): ${fmtBytes(totalBefore)} -> ${fmtBytes(totalAfter)}` +
      ` (${(100 - (totalAfter / totalBefore) * 100).toFixed(1)}% reduction)`,
  );

  if (anyFailed) {
    console.error("\nOne or more assets failed to process. See errors above.");
    process.exit(1);
  }

  console.log("\nDone. Run `npm run build` to check the full public/ budget gate.");
}

main().catch((err) => {
  console.error("Fatal error in asset pipeline:", err);
  process.exit(1);
});
