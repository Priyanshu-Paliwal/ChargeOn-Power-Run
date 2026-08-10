import { NodeIO } from '@gltf-transform/core';
import { KHRDracoMeshCompression, EXTTextureWebP } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import fs from 'fs';
import path from 'path';

const OUT_DIR = 'public/assets/models/buildings';

async function main() {
  const io = new NodeIO()
    .registerExtensions([KHRDracoMeshCompression, EXTTextureWebP])
    .registerDependencies({
      'draco3d.encoder': await draco3d.createEncoderModule(),
      'draco3d.decoder': await draco3d.createDecoderModule(),
    });

  const files = fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.glb'));
  
  for (const file of files) {
    const doc = await io.read(path.join(OUT_DIR, file));
    const root = doc.getRoot();
    
    let min = [Infinity, Infinity, Infinity];
    let max = [-Infinity, -Infinity, -Infinity];
    
    for (const mesh of root.listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const position = prim.getAttribute('POSITION');
        if (!position) continue;
        const count = position.getCount();
        for (let i = 0; i < count; i++) {
          const v = position.getElement(i, []);
          min[0] = Math.min(min[0], v[0]);
          min[1] = Math.min(min[1], v[1]);
          min[2] = Math.min(min[2], v[2]);
          max[0] = Math.max(max[0], v[0]);
          max[1] = Math.max(max[1], v[1]);
          max[2] = Math.max(max[2], v[2]);
        }
      }
    }
    
    console.log(`${file.padEnd(30)} | minY: ${min[1].toFixed(2)} | minX: ${min[0].toFixed(2)} | minZ: ${min[2].toFixed(2)}`);
  }
}

main().catch(console.error);
