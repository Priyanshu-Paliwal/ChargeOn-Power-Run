import * as THREE from 'three';

const PRESETS = {
  dawn: {
    fog: new THREE.Color('#e0b080'),
    ambient: new THREE.Color('#8c9bb4'),
    directional: new THREE.Color('#ffeedd'),
    ambientIntensity: 0.25,
    dirIntensity: 0.85,
    sunElevation: 2, // Degrees above horizon
  },
  day: {
    fog: new THREE.Color('#a0c8e0'),
    ambient: new THREE.Color('#b0d5ff'),
    directional: new THREE.Color('#ffffff'),
    ambientIntensity: 0.45,
    dirIntensity: 1.05,
    sunElevation: 60, // High in the sky
  },
  dusk: {
    fog: new THREE.Color('#c27a69'),
    ambient: new THREE.Color('#6a5acd'),
    directional: new THREE.Color('#ff9e73'),
    ambientIntensity: 0.05,
    dirIntensity: 0.85,
    sunElevation: 2, // Setting
  },
  night: {
    fog: new THREE.Color('#0a0c1a'),
    ambient: new THREE.Color('#111122'), // Deep blue shadow
    directional: new THREE.Color('#7799ff'), // Moonlight
    ambientIntensity: 0.0,
    dirIntensity: 0.1, // Dim moonlight
    sunElevation: -45, // Below horizon
  }
};

const CYCLE = [
  { preset: PRESETS.dawn, stop: 0.0 },
  { preset: PRESETS.day, stop: 0.25 },
  { preset: PRESETS.dusk, stop: 0.5 },
  { preset: PRESETS.night, stop: 0.6 },
  { preset: PRESETS.night, stop: 0.9 },
  { preset: PRESETS.dawn, stop: 1.0 }
];

export class DayNightCycle {
  constructor(engine) {
    this.engine = engine;
    this.timeOfDay = 0.15; // Start at morning/day
    this.cycleDuration = 120; // 2 minutes per full day for dramatic effect
    
    // Cached objects to avoid allocation in loop
    this.currentFog = new THREE.Color();
    this.currentAmbient = new THREE.Color();
    this.currentDir = new THREE.Color();
    
    this.initCelestials();
  }

  initCelestials() {
    // Sun Mesh
    const sunGeo = new THREE.SphereGeometry(15, 32, 32);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffffee, fog: false });
    this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
    this.engine.scene.add(this.sunMesh);

    // Moon Mesh
    const moonGeo = new THREE.SphereGeometry(10, 32, 32);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xddddff, fog: false });
    this.moonMesh = new THREE.Mesh(moonGeo, moonMat);
    this.engine.scene.add(this.moonMesh);

    this.initStars();
    this.initFakeStreetLights();
  }

  initStars() {
    const starGeo = new THREE.BufferGeometry();
    const starCount = 3000;
    const posArray = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount * 3; i++) {
      // Create a large sphere of stars
      posArray[i] = (Math.random() - 0.5) * 2000;
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const starMat = new THREE.PointsMaterial({
      size: 1.5,
      color: 0xffffff,
      transparent: true,
      opacity: 0, // Starts invisible
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.stars = new THREE.Points(starGeo, starMat);
    this.engine.scene.add(this.stars);
  }

  initFakeStreetLights() {
    this.streetLights = [];
    // Create 6 fake point lights to simulate passing streetlights
    for (let i = 0; i < 6; i++) {
      const light = new THREE.PointLight(0xffaa22, 0, 25, 2); // Warm yellow/orange glow
      // Alternate left/right side of track
      const x = (i % 2 === 0) ? -6 : 6;
      const z = -i * 20; // Space them out
      light.position.set(x, 6, z);
      this.engine.scene.add(light);
      this.streetLights.push(light);
    }
  }

  update(delta) {
    // Advance time
    this.timeOfDay += delta / this.cycleDuration;
    if (this.timeOfDay >= 1.0) this.timeOfDay -= 1.0;

    // Find current interval
    let idxA = 0;
    let idxB = 1;
    for (let i = 0; i < CYCLE.length - 1; i++) {
      if (this.timeOfDay >= CYCLE[i].stop && this.timeOfDay < CYCLE[i+1].stop) {
        idxA = i;
        idxB = i + 1;
        break;
      }
    }

    const stageA = CYCLE[idxA];
    const stageB = CYCLE[idxB];
    const range = stageB.stop - stageA.stop;
    const progress = (this.timeOfDay - stageA.stop) / range;
    
    // Smoothstep for natural transitions
    const factor = Math.min(Math.max(progress * progress * (3 - 2 * progress), 0), 1);

    const a = stageA.preset;
    const b = stageB.preset;

    // Interpolate Colors
    this.currentFog.copy(a.fog).lerp(b.fog, factor);
    this.currentAmbient.copy(a.ambient).lerp(b.ambient, factor);
    this.currentDir.copy(a.directional).lerp(b.directional, factor);

    // Interpolate Intensities
    const ambientInt = THREE.MathUtils.lerp(a.ambientIntensity, b.ambientIntensity, factor);
    const dirInt = THREE.MathUtils.lerp(a.dirIntensity, b.dirIntensity, factor);
    const sunElev = THREE.MathUtils.lerp(a.sunElevation, b.sunElevation, factor);

    // Apply to Engine
    if (this.engine.scene.fog) {
      this.engine.scene.fog.color.copy(this.currentFog);
      // Create a NEW color object every frame so Three.js detects the change
      this.engine.scene.background = new THREE.Color().copy(this.currentFog);
    }
    if (this.engine.ambientLight) {
      this.engine.ambientLight.color.copy(this.currentAmbient);
      this.engine.ambientLight.intensity = ambientInt;
    }
    if (this.engine.hemiLight) {
      this.engine.hemiLight.color.copy(this.currentAmbient).multiplyScalar(1.2);
      this.engine.hemiLight.groundColor.copy(this.currentFog).multiplyScalar(0.4);
      this.engine.hemiLight.intensity = ambientInt * 0.8;
    }
    if (this.engine.dirLight) {
      this.engine.dirLight.color.copy(this.currentDir);
      this.engine.dirLight.intensity = dirInt;
    }

    // Update Stars Opacity (Visible mostly at night)
    if (this.stars) {
      let starOpacity = 0;
      if (this.timeOfDay > 0.45 && this.timeOfDay < 0.6) {
          // Fading in during dusk
          starOpacity = (this.timeOfDay - 0.45) / 0.15;
      } else if (this.timeOfDay >= 0.6 && this.timeOfDay <= 0.9) {
          // Full night
          starOpacity = 1.0;
      } else if (this.timeOfDay > 0.9 && this.timeOfDay < 1.0) {
          // Fading out during dawn
          starOpacity = 1.0 - ((this.timeOfDay - 0.9) / 0.1);
      }
      this.stars.material.opacity = starOpacity;
      this.stars.position.z = this.engine.activeZ || 0; // Follow player
      this.stars.rotation.y = this.timeOfDay * Math.PI * 2; // Rotate slowly
    }

    // Update fake streetlights simulating track reflections
    if (this.streetLights) {
      let lightIntensity = 0;
      if (this.timeOfDay > 0.45 && this.timeOfDay < 0.95) {
        // Fade in during dusk, full at night
        lightIntensity = (this.timeOfDay < 0.5) ? (this.timeOfDay - 0.45) * 20 * 400 : 400; // Physically accurate high intensity
      }

      const moveSpeed = (this.engine.world && this.engine.mode === "PLAYING") ? this.engine.world.speed * delta : 0;
      
      for (let i = 0; i < this.streetLights.length; i++) {
        const light = this.streetLights[i];
        light.intensity = lightIntensity;
        
        if (lightIntensity > 0) {
          light.position.z += moveSpeed;
          if (light.position.z > 15) {
            light.position.z -= 120; // 6 lights * 20 spacing = 120
          }
        }
      }
    }

    // Calculate sun vector based on elevation and time of day azimuth
    const phi = THREE.MathUtils.degToRad(90 - sunElev);
    const theta = Math.PI * (this.timeOfDay - 0.5); 
    
    const sunVec = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
    
    if (this.engine.sky) {
      this.engine.sky.material.uniforms['sunPosition'].value.copy(sunVec);
    }
      
    // Update meshes
    if (this.sunMesh) {
        this.sunMesh.position.copy(sunVec).multiplyScalar(400);
        this.sunMesh.position.z += this.engine.activeZ || 0; // Follow player
    }
    if (this.moonMesh) {
        this.moonMesh.position.copy(sunVec).multiplyScalar(-400);
        this.moonMesh.position.z += this.engine.activeZ || 0; // Follow player
    }
      
    // Update dirLight position to match sun
    this.engine.dirLight.position.copy(sunVec).multiplyScalar(50);
  }
}

