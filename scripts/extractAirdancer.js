import { NodeIO } from '@gltf-transform/core';
import { prune, dedup } from '@gltf-transform/functions';

async function extractAirdancer() {
  const io = new NodeIO();
  const document = await io.read('d:/ChargeonOn Runner _ FINAL GAME/folio-2025/folio-2025/static/areas/areas.glb');

  // Find the airdancer nodes
  const root = document.getRoot();
  const airdancerNodes = root.listNodes().filter(n => n.getName().startsWith('refAirDancers'));
  
  if (airdancerNodes.length === 0) {
    console.error('No AirDancer nodes found!');
    return;
  }

  // Create a new scene and add ONLY the first airdancer node
  const scene = document.createScene('AirDancerScene');
  const node = airdancerNodes[0];
  node.setTranslation([0, 0, 0]);
  scene.addChild(node);
  
  // Set the default scene
  root.setDefaultScene(scene);

  // Remove everything else that's not in the default scene
  const allScenes = root.listScenes();
  for (const s of allScenes) {
    if (s !== scene) s.dispose();
  }

  // Optimize and remove unreferenced data
  await document.transform(prune(), dedup());

  // Save the new GLB
  const outPath = 'public/assets/models/environment/airdancer.glb';
  await io.write(outPath, document);
  console.log(`Successfully extracted AirDancer to ${outPath}`);
}

extractAirdancer().catch(console.error);
