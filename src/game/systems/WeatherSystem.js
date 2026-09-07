import * as THREE from 'three';

const WEATHER_STATES = ['CLEAR', 'RAIN', 'SNOW'];
const WEATHER_DURATION = 25; // Seconds per weather state

export class WeatherSystem {
  constructor(engine) {
    this.engine = engine;
    
    // Create Rain System
    const rainGeo = new THREE.BufferGeometry();
    const rainCount = 2000;
    const rainPos = new Float32Array(rainCount * 3);
    for(let i=0; i<rainCount * 3; i++) {
      rainPos[i] = (Math.random() - 0.5) * 100; // Spread over 100x100 area
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    const rainMat = new THREE.PointsMaterial({
      color: 0x88bbff,
      size: 0.15,
      transparent: true,
      opacity: 0.6
    });
    this.rainSystem = new THREE.Points(rainGeo, rainMat);
    this.rainSystem.visible = false;
    
    // Create Snow System
    const snowGeo = new THREE.BufferGeometry();
    const snowCount = 3000;
    const snowPos = new Float32Array(snowCount * 3);
    for(let i=0; i<snowCount * 3; i++) {
      snowPos[i] = (Math.random() - 0.5) * 100;
    }
    snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
    const snowMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.3,
      transparent: true,
      opacity: 0.8
    });
    this.snowSystem = new THREE.Points(snowGeo, snowMat);
    this.snowSystem.visible = false;
    
    // Add to scene but don't add to world streamer so it stays persistent
    this.engine.scene.add(this.rainSystem);
    this.engine.scene.add(this.snowSystem);

    this.currentState = 'CLEAR';
    this.timeInState = 0;
  }

  update(delta) {
    this.timeInState += delta;
    if (this.timeInState > WEATHER_DURATION) {
      this.timeInState = 0;
      // Cycle to the next weather state
      const currentIndex = WEATHER_STATES.indexOf(this.currentState);
      this.currentState = WEATHER_STATES[(currentIndex + 1) % WEATHER_STATES.length];
      
      this.rainSystem.visible = this.currentState === 'RAIN';
      this.snowSystem.visible = this.currentState === 'SNOW';
    }

    // Keep particle system centered roughly on the camera
    const camPos = this.engine.camera.position;
    
    if (this.currentState === 'RAIN') {
      this.rainSystem.position.copy(camPos);
      
      const positions = this.rainSystem.geometry.attributes.position.array;
      for(let i=1; i<positions.length; i+=3) {
        positions[i] -= 35 * delta; // Fall very fast
        positions[i+1] += 25 * delta; // Move backwards relative to player (+Z)
        
        if (positions[i] < -20) {
          positions[i] = 40; // Reset height
          positions[i-1] = (Math.random() - 0.5) * 100; // Reset X
          positions[i+1] = (Math.random() - 0.5) * 100 - 50; // Reset Z ahead of player
        }
      }
      this.rainSystem.geometry.attributes.position.needsUpdate = true;
    }

    if (this.currentState === 'SNOW') {
      this.snowSystem.position.copy(camPos);
      
      const positions = this.snowSystem.geometry.attributes.position.array;
      for(let i=1; i<positions.length; i+=3) {
        positions[i] -= 8 * delta; // Fall slow
        positions[i-1] += Math.sin(this.timeInState * 2 + i) * delta * 4; // Drift X
        positions[i+1] += 15 * delta; // Move backwards relative to player
        
        if (positions[i] < -20) {
          positions[i] = 40;
          positions[i-1] = (Math.random() - 0.5) * 100;
          positions[i+1] = (Math.random() - 0.5) * 100 - 50;
        }
      }
      this.snowSystem.geometry.attributes.position.needsUpdate = true;
    }
  }
}
