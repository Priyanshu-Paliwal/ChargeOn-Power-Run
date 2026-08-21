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

    // roughness/metalness retuned during manual playtesting -- the original
    // 0.3-0.4 metalness (explicitly "for a nice sheen reflecting the
    // sunset") combined with a normal map that was, at the time, literally
    // three.js's own water-ripple texture made the whole road visibly read
    // as WATER rather than asphalt. asphalt_normal.jpg is now a proper
    // procedural grain texture (see optimizeAssets.js), but real asphalt is
    // still a matte, non-metallic surface -- near-zero metalness and high
    // roughness is what actually sells "road," independent of which normal
    // map sits on top.
    this.trackBaseGeo = new THREE.BoxGeometry(10, 0.02, trackLength);
    this.trackBaseMat = new THREE.MeshStandardMaterial({
      map: asphaltTex,
      normalMap: asphaltNormal,
      roughness: 0.9,
      metalness: 0.03,
      color: 0x444444,
    });

    this.laneGeo = new THREE.BoxGeometry(2.8, 0.55, trackLength);
    this.laneMat = new THREE.MeshStandardMaterial({
      map: asphaltTex,
      normalMap: asphaltNormal,
      roughness: 0.85,
      metalness: 0.03,
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

    // --- Subway Surfers Railway Track Additions ---
    // Gravel/Ballast base ground under the tracks
    this.gravelBaseMat = new THREE.MeshStandardMaterial({
      color: 0x8c8376,
      roughness: 1.0,
      metalness: 0.05,
    });

    // Wooden Sleepers (Planks) under each track lane
    this.sleeperGeo = new THREE.BoxGeometry(2.4, 0.1, 0.6);
    this.sleeperMat = new THREE.MeshStandardMaterial({
      color: 0x4a3219,
      roughness: 0.9,
      metalness: 0.1,
    });

    // Metallic Steel Rails (2 rails per lane = 6 total rails)
    this.railGeo = new THREE.BoxGeometry(0.2, 0.2, trackLength);
    this.railMat = new THREE.MeshStandardMaterial({
      color: 0xaaaaaa,
      metalness: 0.9,
      roughness: 0.2,
    });

    const footpathTex = this._createFootpathTexture();

    this.footpathGeo = new THREE.BoxGeometry(10, 0.6, trackLength);
    this.footpathMat = new THREE.MeshStandardMaterial({
      map: footpathTex,
      color: 0xffffff, // Use 100% of the texture color
      roughness: 0.9,
      metalness: 0.0,
    }); // Textured rock/grey sidewalk

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

  _createFootpathTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");

    // Base rock/grey color - lighter so lines stand out
    ctx.fillStyle = "#b0b0b0";
    ctx.fillRect(0, 0, 512, 512);

    // Add noise for rock texture
    for (let i = 0; i < 30000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const intensity = Math.random();
      if (intensity > 0.8) {
        ctx.fillStyle = "rgba(255,255,255,0.4)"; // bright specks
      } else if (intensity < 0.2) {
        ctx.fillStyle = "rgba(0,0,0,0.4)"; // dark specks
      } else {
        ctx.fillStyle = "rgba(100,100,100,0.2)"; // mid tones
      }
      const size = Math.random() > 0.8 ? 3 : 1;
      ctx.fillRect(x, y, size, size);
    }

    // Draw paving lines (large stone tiles) - HUGE thickness to survive grazing angle mipmapping
    ctx.strokeStyle = "rgba(20, 20, 20, 1.0)";
    ctx.lineWidth = 16;

    // Vertical lines
    for (let x = 0; x <= 512; x += 256) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 512);
      ctx.stroke();
    }

    // Horizontal lines
    for (let y = 0; y <= 512; y += 256) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    // Track length is 200, width is 10. To make it square:
    // width: 10 -> repeat 2 (5 units per tile)
    // length: 200 -> repeat 40 (5 units per tile)
    tex.repeat.set(2, 40);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }
}
