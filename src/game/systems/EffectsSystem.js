import * as THREE from "three";

// Coin-pickup particle bursts (Milestone 9 juice). Stands in for a literal
// "scale-pop" on the coin mesh itself -- coins are pooled/reused per chunk
// (WorldStreamer), and the collected coin's Object3D is hidden the instant
// it's hit (CollisionSystem._reportHit) so its slot is immediately free for
// the next recycle; delaying that hide to play a pop animation on the coin
// itself would fight that reuse. A burst spawned at the same world point,
// entirely independent of the coin's own pooled object, reads as "the coin
// burst into a shower of particles" without any of that conflict.
//
// ONE InstancedMesh for every particle across every simultaneously-active
// burst -- a single draw call total, matching the draw-call discipline the
// rest of this codebase holds itself to (Milestone 3's whole
// SceneryInstancer rewrite existed for exactly this reason). Per-instance
// opacity isn't something InstancedMesh supports without a custom shader,
// so particles "decay" by shrinking to zero scale instead of fading alpha
// -- reads as a burst dissolving away, at a fraction of the engineering
// cost of a real fade shader.
const POOL_SIZE = 16; // concurrent bursts -- generous headroom for a magnet sweep grabbing several coins within one second
const PARTICLES_PER_BURST = 6;
const BURST_LIFETIME = 0.4;
const GRAVITY = 4;
const TOTAL_PARTICLES = POOL_SIZE * PARTICLES_PER_BURST;

const _matrix = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _zero = new THREE.Vector3();
const _color = new THREE.Color();

export class EffectsSystem {
  constructor(scene) {
    const geo = new THREE.SphereGeometry(0.08, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ toneMapped: false });
    this.mesh = new THREE.InstancedMesh(geo, mat, TOTAL_PARTICLES);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; // bursts can happen anywhere along the track; bounding-sphere culling on a per-burst-repositioned instanced mesh isn't worth tracking
    this.mesh.count = 0;
    scene.add(this.mesh);

    this._freeSlots = [];
    for (let i = POOL_SIZE - 1; i >= 0; i--) this._freeSlots.push(i);
    this._life = new Float32Array(POOL_SIZE).fill(-1); // -1 = slot inactive
    this._positions = Array.from({ length: TOTAL_PARTICLES }, () => new THREE.Vector3());
    this._velocities = Array.from({ length: TOTAL_PARTICLES }, () => new THREE.Vector3());

    _scale.set(0, 0, 0);
    _matrix.compose(_zero, _quat, _scale);
    for (let i = 0; i < TOTAL_PARTICLES; i++) this.mesh.setMatrixAt(i, _matrix);
  }

  // `position` is a THREE.Vector3 (world space); `color` a hex number.
  // Silently skips if the pool is exhausted rather than allocating a new
  // slot mid-game -- a missed burst is a fully acceptable cosmetic
  // shortfall under a genuinely unusual pickup rate, unlike ever growing
  // the pool during play.
  burst(position, color = 0xffd700) {
    const slotIndex = this._freeSlots.pop();
    if (slotIndex === undefined) return;
    this._life[slotIndex] = 0;
    const base = slotIndex * PARTICLES_PER_BURST;
    _color.setHex(color);
    for (let p = 0; p < PARTICLES_PER_BURST; p++) {
      const idx = base + p;
      this._positions[idx].copy(position);
      const angle = (p / PARTICLES_PER_BURST) * Math.PI * 2 + Math.random() * 0.5;
      const outward = 1.2 + Math.random() * 1.2;
      const upward = 1.5 + Math.random() * 1.5;
      this._velocities[idx].set(Math.cos(angle) * outward, upward, Math.sin(angle) * outward);
      this.mesh.setColorAt(idx, _color);
    }
    if (this.mesh.count < base + PARTICLES_PER_BURST) this.mesh.count = base + PARTICLES_PER_BURST;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(delta) {
    if (this._freeSlots.length === POOL_SIZE) return; // nothing active -- skip the matrix upload entirely
    for (let slotIndex = 0; slotIndex < POOL_SIZE; slotIndex++) {
      if (this._life[slotIndex] < 0) continue;
      this._life[slotIndex] += delta;
      const t = this._life[slotIndex] / BURST_LIFETIME;
      const base = slotIndex * PARTICLES_PER_BURST;

      if (t >= 1) {
        this._life[slotIndex] = -1;
        this._freeSlots.push(slotIndex);
        _scale.set(0, 0, 0);
        _matrix.compose(_zero, _quat, _scale);
        for (let p = 0; p < PARTICLES_PER_BURST; p++) this.mesh.setMatrixAt(base + p, _matrix);
        continue;
      }

      const scaleFactor = Math.max(0, 1 - t) * 0.6;
      _scale.setScalar(scaleFactor);
      for (let p = 0; p < PARTICLES_PER_BURST; p++) {
        const idx = base + p;
        this._velocities[idx].y -= GRAVITY * delta;
        this._positions[idx].addScaledVector(this._velocities[idx], delta);
        _matrix.compose(this._positions[idx], _quat, _scale);
        this.mesh.setMatrixAt(idx, _matrix);
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
