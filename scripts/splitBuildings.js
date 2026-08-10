import { NodeIO } from '@gltf-transform/core';
import { draco, prune, textureCompress } from '@gltf-transform/functions';
import { KHRDracoMeshCompression, EXTTextureWebP } from '@gltf-transform/extensions';
import fs from 'fs';
import path from 'path';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';

const PACKS = [
  {
    file: 'public/bydikshant2/low_poly_accommodations_buildings.glb',
    // 10 buildings
    targets: [
      'PublicBuilding_1', 'PublicBuilding_2', 'PublicBuilding_3', 'PublicBuilding_4', 'PublicBuilding_5',
      'PublicBuilding_6', 'PublicBuilding_7', 'PublicBuilding_8', 'PublicBuilding_9', 'PublicBuilding_10'
    ]
  },
  {
    file: 'public/bydikshant2/low_poly_business_buildings_pack.glb',
    // 7 buildings
    targets: [
      'RestaurantBuilding', 'ShopBuilding', 'PizzaBuilding', 
      'BurgerBuilding', 'CafeBuilding', 'ShoppingCenterBuilding', 'Cinema'
    ]
  }
];

const OUT_DIR = 'public/assets/models/buildings';

async function main() {
  const io = new NodeIO()
    .registerExtensions([KHRDracoMeshCompression, EXTTextureWebP])
    .registerDependencies({
      'draco3d.encoder': await draco3d.createEncoderModule(),
      'draco3d.decoder': await draco3d.createDecoderModule(),
    });

  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  for (const pack of PACKS) {
    console.log(`\nProcessing pack: ${path.basename(pack.file)}`);
    
    for (const targetName of pack.targets) {
      console.log(`  Extracting ${targetName}...`);
      // Read a fresh copy of the document for each target
      const doc = await io.read(pack.file);
      const root = doc.getRoot();
      
      // Find the parent node that contains all buildings (RootNode)
      let containerNode = null;
      for (const node of root.listNodes()) {
        if (node.getName() === 'RootNode') {
          containerNode = node;
          break;
        }
      }
      
      if (!containerNode) {
        console.error('Could not find RootNode');
        continue;
      }
      
      // Keep only the target node, dispose everything else in the container
      for (const child of containerNode.listChildren()) {
        if (child.getName() !== targetName) {
          child.dispose();
        } else {
          // Remove any local translations/rotations/scale from the target node
          // to normalize it, since SceneryInstancer will handle centering and placement.
          child.setTranslation([0, 0, 0]);
          child.setRotation([0, 0, 0, 1]);
          child.setScale([1, 1, 1]);
        }
      }

      // Optimize
      await doc.transform(
        prune(),
        textureCompress({ encoder: sharp, targetFormat: 'webp' }),
        draco()
      );

      // Save
      const outFile = path.join(OUT_DIR, `${targetName}.glb`);
      await io.write(outFile, doc);
      console.log(`    Saved: ${outFile} (${(fs.statSync(outFile).size / 1024).toFixed(1)} KB)`);
    }
  }
}

main().catch(console.error);
