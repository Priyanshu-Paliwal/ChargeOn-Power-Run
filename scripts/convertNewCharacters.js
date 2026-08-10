import { execSync } from 'child_process';
import { NodeIO } from '@gltf-transform/core';
import { KHRDracoMeshCompression } from '@gltf-transform/extensions';
import { draco, prune, dedup, mergeDocuments, unpartition } from '@gltf-transform/functions';
import fs from 'fs';
import path from 'path';
import draco3d from 'draco3dgltf';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const FBX2GLTF = path.join(ROOT_DIR, 'fbx2gltf.exe');

const INPUT_MODELS_DIR = path.join(ROOT_DIR, 'public/bydikshant/All 4 Character');
const INPUT_ANIMS_DIR = path.join(ROOT_DIR, 'public/bydikshant/All Moves');
const TEMP_DIR = path.join(ROOT_DIR, 'public/assets/characters-temp');
const OUT_DIR = path.join(ROOT_DIR, 'public/assets/characters-new');

const MODEL_MAPPING = {
  'vanguard_male_character.fbx': 'male_suit.glb',
  'michelle_female_character.fbx': 'female_suit.glb',
  'aj_anime_male_character.fbx': 'anime_tech.glb',
  'amy_anime_female_character.fbx': 'anime_wizard.glb'
};

const ANIM_MAPPING = {
  'breathing_idle.fbx': 'Idle',
  'Running.fbx': 'Run',
  'running_jump.fbx': 'Jump',
  'Running Slide.fbx': 'Slide',
  'fall_flat_on_game_loose.fbx': 'Fall',
  'jogging_stumble.fbx': 'Stumble',
  'victory.fbx': 'Celebrate',
  'running_jump_on_place.fbx': 'Land'
};

function ensureDir(d) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

ensureDir(TEMP_DIR);
ensureDir(OUT_DIR);

async function main() {
  const io = new NodeIO()
    .registerExtensions([KHRDracoMeshCompression])
    .registerDependencies({
      'draco3d.encoder': await draco3d.createEncoderModule(),
      'draco3d.decoder': await draco3d.createDecoderModule(),
    });

  console.log("Converting Models...");
  for (const [fbxName, outName] of Object.entries(MODEL_MAPPING)) {
    const inPath = path.join(INPUT_MODELS_DIR, fbxName);
    const tempPath = path.join(TEMP_DIR, outName);
    
    console.log(`  fbx2gltf: ${fbxName}`);
    execSync(`"${FBX2GLTF}" -i "${inPath}" -o "${tempPath}" -b`);
    
    const doc = await io.read(tempPath);
    
    // Remove all animations from models
    for (const anim of doc.getRoot().listAnimations()) {
      anim.dispose();
    }
    
    // Rotate 180 degrees around Y-axis to face the track (-Z)
    const rootNodes = doc.getRoot().listScenes()[0].listChildren();
    const wrapperNode = doc.createNode('RotationWrapper').setRotation([0, 1, 0, 0]);
    for (const node of rootNodes) {
      wrapperNode.addChild(node);
    }
    doc.getRoot().listScenes()[0].addChild(wrapperNode);
    
    await doc.transform(
      prune(),
      dedup(),
      draco({ method: 'edgebreaker', compressionLevel: 7 })
    );
    
    const outPath = path.join(OUT_DIR, outName);
    await io.write(outPath, doc);
    console.log(`  Saved: ${outName}`);
  }

  console.log("\nConverting Animations...");
  let masterDoc = null;
  let masterNodes = new Map();

  for (const [fbxName, animName] of Object.entries(ANIM_MAPPING)) {
    const inPath = path.join(INPUT_ANIMS_DIR, fbxName);
    const tempPath = path.join(TEMP_DIR, fbxName.replace('.fbx', '.glb'));
    
    console.log(`  fbx2gltf: ${fbxName} -> ${animName}`);
    execSync(`"${FBX2GLTF}" -i "${inPath}" -o "${tempPath}" -b`);
    
    const doc = await io.read(tempPath);
    const animations = doc.getRoot().listAnimations();
    if (animations.length === 0) continue;
    
    const sourceClip = animations[0];

    if (!masterDoc) {
      masterDoc = doc;
      sourceClip.setName(animName);
      
      // Strip meshes, materials, textures to leave only skeleton and this first anim
      for (const mesh of masterDoc.getRoot().listMeshes()) mesh.dispose();
      for (const mat of masterDoc.getRoot().listMaterials()) mat.dispose();
      for (const tex of masterDoc.getRoot().listTextures()) tex.dispose();
      
      // Cache node name -> node reference mapping
      for (const node of masterDoc.getRoot().listNodes()) {
        masterNodes.set(node.getName(), node);
      }
    } else {
      sourceClip.setName(animName);
      mergeDocuments(masterDoc, doc);
      
      // Find the newly merged animation in masterDoc (it will be the last one)
      const masterAnimations = masterDoc.getRoot().listAnimations();
      const newClip = masterAnimations[masterAnimations.length - 1];
      
      // Remap channels to original nodes
      for (const channel of newClip.listChannels()) {
        const targetPath = channel.getTargetPath();
        if (targetPath === 'translation' || targetPath === 'scale') {
          // Strip translation and scale to remove root motion and ensure proportion independence
          channel.dispose();
          continue;
        }

        const targetNode = channel.getTargetNode();
        if (!targetNode) continue;
        
        const nodeName = targetNode.getName();
        const masterNode = masterNodes.get(nodeName);
        
        if (masterNode) {
          channel.setTargetNode(masterNode);
        } else {
          console.warn(`    Warning: Node ${nodeName} not found in master skeleton for animation ${animName}.`);
        }
      }
    }
  }
  
  if (masterDoc) {
    await masterDoc.transform(unpartition(), prune(), dedup());
    const animOutPath = path.join(OUT_DIR, 'animations.glb');
    await io.write(animOutPath, masterDoc);
    console.log(`  Saved: animations.glb`);
  }
  
  console.log("\nCleanup TEMP_DIR...");
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
}

main().catch(console.error);
