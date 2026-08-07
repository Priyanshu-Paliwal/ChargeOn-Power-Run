import * as THREE from "three";

// Track surface geometry/materials: the road base, 3 lanes, concrete
// borders (procedural fallback for when no railing model is available),
// and the yellow trim lines. Pure factory -- no per-frame logic, no
// per-chunk state.
//
// These pieces used to be added as direct (non-instanced) children of each
// chunk group -- cheap individually, but 15 chunks x ~6 pieces still added
// up to ~90 draw calls for track alone. SceneryInstancer turns each of
// these geometries into one global InstancedMesh (one draw call covers all
// 15 chunks' worth), the same mechanism it uses for the GLB-based scenery.
export class TrackBuilder {
  constructor(trackLength, asphaltNormalTexture) {
    this.trackLength = trackLength;

    const asphaltTex = this._createAsphaltTexture();

    let asphaltNormal = null;
    if (asphaltNormalTexture) {
      asphaltNormal = asphaltNormalTexture;
      asphaltNormal.wrapS = THREE.RepeatWrapping;
      asphaltNormal.wrapT = THREE.RepeatWrapping;
      asphaltNormal.repeat.set(4, 20); // Scale the normal map to look like grit
    }

    this.trackBaseGeo = new THREE.BoxGeometry(10, 0.5, trackLength);
    this.trackBaseMat = new THREE.MeshStandardMaterial({
      map: asphaltTex,
      normalMap: asphaltNormal,
      roughness: 0.5,
      metalness: 0.3, // Gives a nice sheen reflecting the sunset
      color: 0x444444,
    });

    this.laneGeo = new THREE.BoxGeometry(2.8, 0.55, trackLength);
    this.laneMat = new THREE.MeshStandardMaterial({
      map: asphaltTex,
      normalMap: asphaltNormal,
      roughness: 0.4,
      metalness: 0.4,
      color: 0x555555,
    });

    this.borderGeo = new THREE.BoxGeometry(0.5, 0.8, trackLength);
    this.borderMat = new THREE.MeshStandardMaterial({
      color: 0x888888,
      roughness: 1.0,
    }); // Concrete border

    this.trimGeo = new THREE.BoxGeometry(0.1, 0.56, trackLength);
    this.trimMat = new THREE.MeshStandardMaterial({
      color: 0xffcc00,
      roughness: 0.5,
      metalness: 0.2,
    }); // Yellow dividing lines

    this.laneX = [-3, 0, 3];
    this.trimX = [-1.5, 1.5];
  }

  _createAsphaltTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#333333";
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 5000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const isLight = Math.random() > 0.5;
      ctx.fillStyle = isLight ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.15)";
      ctx.fillRect(x, y, 2, 2);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 4);
    return tex;
  }
}
