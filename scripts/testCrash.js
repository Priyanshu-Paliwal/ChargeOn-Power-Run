import { Matrix4, Vector3, BufferGeometry, Mesh, Material, Box3, InstancedMesh } from 'three';
import fs from 'fs';

// Mock models and test SceneryInstancer.js
async function run() {
  const SceneryInstancerModule = await import('../src/game/world/SceneryInstancer.js');
  const SceneryInstancer = SceneryInstancerModule.SceneryInstancer;
  
  // Will initialize later
  // Mock model with a BufferGeometry
  const geometry = new BufferGeometry();
  // Provide position attribute with 3 vertices so it's not empty
  geometry.setAttribute('position', { count: 3 });
  geometry.computeBoundingBox = function() {
    this.boundingBox = new Box3(new Vector3(-5, -5, -5), new Vector3(5, 5, 5));
  };
  
  const mesh = new Mesh(geometry, new Material());
  mesh.matrixWorld = new Matrix4();
  
  // Create mock root
  const root = {
    updateMatrixWorld: () => {},
    traverse: (cb) => {
      cb(mesh);
    }
  };
  
  const models = {
    "PublicBuilding_1": root,
    "RestaurantBuilding": root,
    "tree_1": root,
    "trackBase": root,
    "lane": root,
    "trim": root,
    "railing": root
  };
  
  const trackBuilder = {
    laneX: [-1, 0, 1],
    trimX: [-2, 2],
    trackBaseGeo: geometry,
    trackBaseMat: new Material(),
    laneGeo: geometry,
    laneMat: new Material(),
    trimGeo: geometry,
    trimMat: new Material()
  };
  
  const scene = { add: () => {} };
  const instancer = new SceneryInstancer(scene, 5, trackBuilder);
  instancer.build(models);
  
  console.log("Calling registerChunkSlots...");
  for (let i=0; i<5; i++) {
    instancer.registerChunkSlots(i);
  }
  console.log("Success! No crash.");
}

run().catch(console.error);
