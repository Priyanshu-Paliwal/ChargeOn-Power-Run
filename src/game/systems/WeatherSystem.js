import * as THREE from "three";

// Creates a sleek, elongated, motion-blurred rain streak texture
function createRaindropTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, 32, 128);

  ctx.save();
  // Slight angle to simulate wind and high-speed forward rush
  ctx.translate(16, 64);
  ctx.rotate(0.08);
  ctx.translate(-16, -64);

  // Vertical gradient for rain streak:
  // - Top: thin, soft transparent tail
  // - Mid: luminous translucent body
  // - Bottom: bright rounded droplet head
  const grad = ctx.createLinearGradient(16, 4, 16, 124);
  grad.addColorStop(0.0, "rgba(215, 238, 255, 0.0)");
  grad.addColorStop(0.2, "rgba(200, 230, 255, 0.25)");
  grad.addColorStop(0.7, "rgba(220, 242, 255, 0.7)");
  grad.addColorStop(0.95, "rgba(255, 255, 255, 0.95)");
  grad.addColorStop(1.0, "rgba(230, 245, 255, 0.0)");

  // Draw tapered streak (narrow at top, smooth teardrop at bottom)
  ctx.beginPath();
  ctx.moveTo(15, 6);
  ctx.lineTo(17, 6);
  ctx.lineTo(18.5, 114);
  ctx.arc(16, 114, 2.5, 0, Math.PI);
  ctx.lineTo(13.5, 114);
  ctx.closePath();

  ctx.fillStyle = grad;
  ctx.fill();

  // Soft luminous droplet glow at the head
  const coreGrad = ctx.createRadialGradient(16, 114, 0, 16, 114, 6);
  coreGrad.addColorStop(0.0, "rgba(255, 255, 255, 0.85)");
  coreGrad.addColorStop(0.5, "rgba(190, 225, 255, 0.4)");
  coreGrad.addColorStop(1.0, "rgba(170, 215, 255, 0.0)");
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.arc(16, 114, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// Creates a soft, circular, fluffy snowflake ball texture (pure circle, zero square artifacts)
function createSnowflakeTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, 64, 64);

  // Multi-stop radial gradient for a soft, circular snow puff
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
  grad.addColorStop(0.0, "rgba(255, 255, 255, 1.0)"); // Bright white core
  grad.addColorStop(0.35, "rgba(250, 252, 255, 0.92)"); // Fluffy snow body
  grad.addColorStop(0.65, "rgba(225, 240, 255, 0.45)"); // Translucent frosted rim
  grad.addColorStop(0.88, "rgba(210, 230, 255, 0.15)"); // Soft feathered perimeter
  grad.addColorStop(1.0, "rgba(200, 225, 255, 0.0)"); // Smooth edge fade to transparent

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(32, 32, 30, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export class WeatherSystem {
  constructor(engine) {
    this.engine = engine;

    // Create Rain System with textured rain streaks
    const rainGeo = new THREE.BufferGeometry();
    const rainCount = 2200;
    const rainPos = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount * 3; i += 3) {
      rainPos[i] = (Math.random() - 0.5) * 70; // X: focused around track width
      rainPos[i + 1] = (Math.random() - 0.5) * 50; // Y: height
      rainPos[i + 2] = (Math.random() - 0.5) * 80 - 15; // Z: ahead and around player
    }
    rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));

    const rainMat = new THREE.PointsMaterial({
      color: 0xd8eeff,
      size: 0.75, // Sleek, natural raindrop streak
      map: createRaindropTexture(),
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      blending: THREE.AdditiveBlending, // Glistening wet rain sheen
    });
    this.rainSystem = new THREE.Points(rainGeo, rainMat);
    this.rainSystem.visible = false;

    // Create Snow System with deep volumetric 3D depth and soft circular snowflakes
    const snowGeo = new THREE.BufferGeometry();
    const snowCount = 3800;
    const snowPos = new Float32Array(snowCount * 3);
    for (let i = 0; i < snowCount * 3; i += 3) {
      // Distribute Z deeply down the track from just ahead of the camera (-6) out to the far horizon (-220)
      const z = -6.0 - Math.random() * 214.0;
      // Frustum-aware X spread based on distance so snow blankets the entire field of view
      const spreadX = 24.0 + Math.abs(z) * 0.55;
      snowPos[i] = (Math.random() - 0.5) * spreadX; // X: wide coverage matching camera perspective
      snowPos[i + 1] = -8.0 + Math.random() * 72.0; // Y: from ground level up to high sky canopy
      snowPos[i + 2] = z; // Z: deep into the distance
    }
    snowGeo.setAttribute("position", new THREE.BufferAttribute(snowPos, 3));

    const snowMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.75, // Visible, soft circular fluff ball
      map: createSnowflakeTexture(),
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    this.snowSystem = new THREE.Points(snowGeo, snowMat);
    this.snowSystem.visible = false;

    // Add to scene
    this.engine.scene.add(this.rainSystem);
    this.engine.scene.add(this.snowSystem);

    // Weather state synced with Day / Night cycle
    this.currentState = "CLEAR";
    this.nightWeatherMode = "SNOW"; // First night starts with SNOW, next night RAIN, alternating!
    this.wasNight = false;
    this.manualOverride = false;
    this.timeInState = 0;
  }

  // Developer control to force specific weather for testing
  setWeather(state) {
    this.manualOverride = true;
    this.currentState = state;
    this.rainSystem.visible = state === "RAIN";
    this.snowSystem.visible = state === "SNOW";
    this.rainSystem.material.opacity = 0.75;
    this.snowSystem.material.opacity = 0.85;
  }

  // Resumes automatic day/night weather alternation
  resumeAutoWeather() {
    this.manualOverride = false;
  }

  // Developer convenience to jump timeOfDay straight to night
  setNight() {
    if (this.engine.dayNightCycle) {
      this.engine.dayNightCycle.timeOfDay = 0.62;
    }
  }

  // Developer convenience to jump timeOfDay straight to day
  setDay() {
    if (this.engine.dayNightCycle) {
      this.engine.dayNightCycle.timeOfDay = 0.2;
    }
  }

  update(delta) {
    this.timeInState += delta;

    // Synchronize weather with Day/Night cycle
    const dayNight = this.engine.dayNightCycle;
    if (dayNight && !this.manualOverride) {
      const timeOfDay = dayNight.timeOfDay;
      // Night is from 0.55 (dusk) to 0.90 (dawn)
      const isNight = timeOfDay >= 0.55 && timeOfDay < 0.90;

      if (isNight && !this.wasNight) {
        // Night just arrived! Activate current night weather (alternating SNOW <-> RAIN)
        this.wasNight = true;
        this.currentState = this.nightWeatherMode;
        // Schedule opposite weather for the following night
        this.nightWeatherMode =
          this.nightWeatherMode === "SNOW" ? "RAIN" : "SNOW";
      } else if (!isNight && this.wasNight) {
        // Dawn / Daytime has arrived! Clear skies for sunny running
        this.wasNight = false;
        this.currentState = "CLEAR";
      }

      // Smooth fade-in during dusk (0.55 to 0.60) and fade-out during dawn (0.85 to 0.90)
      let weatherIntensity = 0;
      if (isNight) {
        if (timeOfDay < 0.60) {
          weatherIntensity = (timeOfDay - 0.55) / 0.05; // Smooth fade in over dusk
        } else if (timeOfDay > 0.85) {
          weatherIntensity = (0.90 - timeOfDay) / 0.05; // Smooth fade out over dawn
        } else {
          weatherIntensity = 1.0; // Full night atmosphere
        }
      }

      const isRain = this.currentState === "RAIN" && weatherIntensity > 0;
      const isSnow = this.currentState === "SNOW" && weatherIntensity > 0;

      this.rainSystem.visible = isRain;
      this.snowSystem.visible = isSnow;

      if (isRain) {
        this.rainSystem.material.opacity = 0.75 * weatherIntensity;
      }
      if (isSnow) {
        this.snowSystem.material.opacity = 0.85 * weatherIntensity;
      }
    }

    // Keep particle system centered roughly on the camera
    const camPos = this.engine.camera.position;

    if (this.rainSystem.visible) {
      this.rainSystem.position.copy(camPos);

      const positions = this.rainSystem.geometry.attributes.position.array;
      for (let i = 1; i < positions.length; i += 3) {
        // Tuned comfortable rain fall speed (moderated from 48 down to 34)
        positions[i] -= 34 * delta;
        positions[i + 1] += 18 * delta; // Relative backward motion matching runner velocity

        if (positions[i] < -18) {
          positions[i] = 32 + Math.random() * 10; // Reset height above camera
          positions[i - 1] = (Math.random() - 0.5) * 65; // Reset X
          positions[i + 1] = (Math.random() - 0.5) * 75 - 20; // Reset Z ahead of camera
        }
      }
      this.rainSystem.geometry.attributes.position.needsUpdate = true;
    }

    if (this.snowSystem.visible) {
      this.snowSystem.position.copy(camPos);

      const positions = this.snowSystem.geometry.attributes.position.array;
      for (let i = 1; i < positions.length; i += 3) {
        // Individualized graceful fall speed
        const fallSpeed = 5.2 + ((i * 13) % 20) * 0.12;
        positions[i] -= fallSpeed * delta;

        // Natural multi-harmonic horizontal flutter/sway
        positions[i - 1] +=
          (Math.sin(this.timeInState * 1.5 + i * 0.17) * 1.6 +
            Math.cos(this.timeInState * 0.8 + i * 0.07) * 0.8) *
          delta;

        // Forward relative drift matching runner velocity
        positions[i + 1] += 12 * delta;

        // Wrap particles when they fall below ground level (Y < -10.0)
        // OR when they drift too close to camera lens (Z > -6.0) to prevent particles slapping the screen
        if (positions[i] < -10.0 || positions[i + 1] > -6.0) {
          // Respawn in the far distance and high in the night sky
          const respawnZ = -25.0 - Math.random() * 195.0; // -25 to -220
          positions[i + 1] = respawnZ;
          positions[i] = 28.0 + Math.random() * 40.0; // 28 to 68 (high in the sky)
          const spreadX = 24.0 + Math.abs(respawnZ) * 0.55;
          positions[i - 1] = (Math.random() - 0.5) * spreadX;
        }
      }
      this.snowSystem.geometry.attributes.position.needsUpdate = true;
    }
  }
}
