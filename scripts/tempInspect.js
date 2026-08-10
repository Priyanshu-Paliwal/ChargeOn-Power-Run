import { NodeIO } from '@gltf-transform/core';
import { KHRDracoMeshCompression, EXTTextureWebP } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';

async function run() { 
  const io = new NodeIO().registerExtensions([KHRDracoMeshCompression, EXTTextureWebP]).registerDependencies({'draco3d.encoder': await draco3d.createEncoderModule(), 'draco3d.decoder': await draco3d.createDecoderModule()}); 
  const doc = await io.read('public/assets/models/buildings/RestaurantBuilding.glb'); 
  const root = doc.getRoot(); 
  console.log('Meshes:', root.listMeshes().length, 'Nodes:', root.listNodes().length); 
  root.listScenes()[0].listChildren().forEach(n => console.log(n.getName())); 
} 
run().catch(console.error);
