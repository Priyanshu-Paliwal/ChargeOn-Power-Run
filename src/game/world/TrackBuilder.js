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
      color: 0x999999,
    });

    this.laneGeo = new THREE.BoxGeometry(2.8, 0.55, trackLength);
    this.laneMat = new THREE.MeshStandardMaterial({
      map: asphaltTex,
      normalMap: asphaltNormal,
      roughness: 0.85,
      metalness: 0.03,
      color: 0x555555,
    });

    // Concrete border/curb mesh
    this.borderGeo = new THREE.BoxGeometry(0.5, 0.8, trackLength);
    this.borderMat = new THREE.MeshStandardMaterial({
      color: 0xd0d0d0, // Distinctly lighter/brighter concrete to read as a raised edge
      roughness: 0.8,
      metalness: 0.0,
    });

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

    // Footpath PBR Material
    const footpathTex = this._createFootpathTextures();
    this.footpathGeo = new THREE.BoxGeometry(6, 0.3, trackLength);
    this.footpathMat = new THREE.MeshStandardMaterial({
      color: 0x444444, // Base tint
      // color: 0x999999, // Base tint
      map: footpathTex.diffuse,
      bumpMap: footpathTex.bump,
      // bumpScale: 0.055, // Very subtle depth for expansion joints
      bumpScale: 0.1, // Very subtle depth for expansion joints
      roughnessMap: footpathTex.roughness,
      metalness: 0.0,
    });

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

  // Generates complete procedural PBR textures for the footpath (0 new network calls/assets)
  _createFootpathTextures() {
    const size = 512; // Back to 512 for cleaner mipmapping

    // 1. Diffuse (Color) Map
    const diffCanvas = document.createElement("canvas");
    diffCanvas.width = size;
    diffCanvas.height = size;
    const diffCtx = diffCanvas.getContext("2d");

    // Base concrete grey
    diffCtx.fillStyle = "#8a8a8a";
    diffCtx.fillRect(0, 0, size, size);

    // Subtle Low-Contrast Noise/Speckles (Avoid high frequency)
    for (let i = 0; i < 8000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      diffCtx.fillStyle =
        Math.random() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.08)";
      // Larger 3x3 blocks prevent tiny 1-pixel high-frequency aliasing from far away
      diffCtx.fillRect(x, y, 3, 3);
    }

    // Expansion joints (Diffuse - dark subtle line)
    // diffCtx.strokeStyle = "rgba(50, 50, 50, 0.4)";
    diffCtx.strokeStyle = "rgba(255, 255, 255, 1)";
    diffCtx.lineWidth = 10;
    diffCtx.beginPath();
    diffCtx.moveTo(0, 0);
    diffCtx.lineTo(size, 0); // Top edge joint
    diffCtx.moveTo(size / 2, 0);
    diffCtx.lineTo(size / 2, size); // Middle vertical joint
    diffCtx.stroke();

    // 2. Bump (Height) Map
    const bumpCanvas = document.createElement("canvas");
    bumpCanvas.width = size;
    bumpCanvas.height = size;
    const bumpCtx = bumpCanvas.getContext("2d");

    // White = Flat high surface
    // CRITICAL FIX: No random pitting dots here. Tiny dots in a bump map
    // cause severe Moiré/corduroy stripe patterns at low grazing angles.
    bumpCtx.fillStyle = "#ffffff";
    bumpCtx.fillRect(0, 0, size, size);

    // Expansion joints (Black = deep groove)
    // bumpCtx.strokeStyle = "rgba(0, 0, 0, 0.5)"; // Softened intensity
    bumpCtx.strokeStyle = "rgba(255, 255, 255, 1)"; // Softened intensity
    bumpCtx.lineWidth = 6;
    bumpCtx.beginPath();
    bumpCtx.moveTo(0, 0);
    bumpCtx.lineTo(size, 0);
    bumpCtx.moveTo(size / 2, 0);
    bumpCtx.lineTo(size / 2, size);
    bumpCtx.stroke();

    // 3. Roughness Map
    const roughCanvas = document.createElement("canvas");
    roughCanvas.width = size;
    roughCanvas.height = size;
    const roughCtx = roughCanvas.getContext("2d");

    // Concrete is very rough (mostly white/light-grey)
    roughCtx.fillStyle = "#e0e0e0";
    roughCtx.fillRect(0, 0, size, size);

    // Slight smudges/puddles (darker patches = smoother)
    for (let i = 0; i < 4000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      roughCtx.fillStyle = "rgba(150, 150, 150, 1)";
      roughCtx.fillRect(x, y, 4, 4);
    }

    // Convert to Three.js textures
    const diffuse = new THREE.CanvasTexture(diffCanvas);
    diffuse.colorSpace = THREE.SRGBColorSpace;
    const bump = new THREE.CanvasTexture(bumpCanvas);
    const roughness = new THREE.CanvasTexture(roughCanvas);

    [diffuse, bump, roughness].forEach((t) => {
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
      // Width is 6 units. Length is trackLength (usually 30).
      // Repeat U=1 (6 units wide), Repeat V=5 (30 units long) makes perfect 3x3 square slabs!
      t.repeat.set(1, 2.5);
      t.anisotropy = 16; // CRITICAL: Keeps the lines sharp in the distance!
      t.needsUpdate = true;
    });

    return { diffuse, bump, roughness };
  }
}
