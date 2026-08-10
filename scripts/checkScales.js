import { NodeIO } from '@gltf-transform/core';
import { KHRDracoMeshCompression, EXTTextureWebP } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import path from 'path';

async function run() { 
  const io = new NodeIO().registerExtensions([KHRDracoMeshCompression, EXTTextureWebP]).registerDependencies({'draco3d.encoder': await draco3d.createEncoderModule(), 'draco3d.decoder': await draco3d.createDecoderModule()}); 
  const doc = await io.read('public/assets/models/buildings/PublicBuilding_1.glb'); 
  
  const root = doc.getRoot();
  const scene = root.listScenes()[0];
  
  const printTransforms = (node, depth = 0) => {
    const indent = '  '.repeat(depth);
    const s = node.getScale();
    const t = node.getTranslation();
    console.log(`${indent}- ${node.getName()} | scale: [${s[0].toFixed(4)}, ${s[1].toFixed(4)}, ${s[2].toFixed(4)}] | trans: [${t[0].toFixed(2)}, ${t[1].toFixed(2)}, ${t[2].toFixed(2)}]`);
    for (const child of node.listChildren()) {
      printTransforms(child, depth + 1);
    }
  };
  
  for (const node of scene.listChildren()) {
    printTransforms(node, 0);
  }
} 
run().catch(console.error);
