import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { CHARACTERS, CHARACTER_ANIMATIONS_URL, FLYING_ANIMATION_URL } from "../config/GameConfig.js";

// Today's placeholder characters (Milestone 7) aren't Draco-compressed, so
// this isn't strictly required yet -- but a real licensed replacement
// model very well might be (see Engine.js's loadAssets(), where every
// environment GLB IS Draco-compressed and silently failed to parse without
// this exact wiring). Attaching it now means that swap-in stays truly
// zero-code-change, matching the promise in GameConfig.js's CHARACTERS
// comment, instead of quietly breaking the same way scenery did.
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("/draco/");

// Loads and caches the shared animation library plus each character's own
// GLTF. A single instance is shared by every Player (there is normally only
// one, but Milestone 7's CharacterSelect turntable and any future "ghost
// racer"/multiplayer use would both want the same cache) so switching
// characters never re-fetches a model or the animation file twice.
//
// See GameConfig.js's CHARACTERS comment for the model contract this loader
// assumes: shared Mixamo bone names, Y-up/-Z-forward, ~1.8 units tall, no
// animations embedded in the character file itself.
export class CharacterLoader {
  constructor() {
    this._gltfLoader = new GLTFLoader();
    this._gltfLoader.setDRACOLoader(dracoLoader);
    this._fbxLoader = new FBXLoader();
    this._animationsPromise = null;
    this._modelPromises = new Map(); // id -> Promise<GLTF>
  }

  loadAnimations() {
    if (!this._animationsPromise) {
      this._animationsPromise = Promise.all([
        this._gltfLoader.loadAsync(CHARACTER_ANIMATIONS_URL),
        this._fbxLoader.loadAsync(FLYING_ANIMATION_URL)
      ]).then(([gltf, fbx]) => {
        const clips = [...gltf.animations];
        if (fbx.animations && fbx.animations.length > 0) {
          const flyingClip = fbx.animations[0];
          flyingClip.name = "Flying"; // rename to ensure it matches what Player.js expects
          
          // The raw FBX animation contains root motion that pushes the character mesh
          // away from its container (and thus separates it from the jetpack).
          // Strip position tracks to make it an in-place animation!
          flyingClip.tracks = flyingClip.tracks.filter(track => !track.name.endsWith('.position'));
          
          clips.push(flyingClip);
        }
        return clips;
      });
    }
    return this._animationsPromise;
  }

  // Returns a cached (or freshly started) load for one character. Safe to
  // call repeatedly with the same id -- the network fetch only ever happens
  // once per id, regardless of how many times a player swaps characters.
  loadCharacter(id) {
    if (!this._modelPromises.has(id)) {
      const def = CHARACTERS.find((c) => c.id === id);
      if (!def) return Promise.reject(new Error(`CharacterLoader: unknown character id ${id}`));
      this._modelPromises.set(id, this._gltfLoader.loadAsync(def.url));
    }
    return this._modelPromises.get(id);
  }

  // Kicks off every character's load up front. Engine.js calls this once,
  // as soon as it exists, so by the time a visitor is actually choosing a
  // character on the Lobby screen every option is already warm -- only the
  // FIRST selection (whatever the default is) is ever on the critical path.
  prefetchAll() {
    return Promise.all([this.loadAnimations(), ...CHARACTERS.map((c) => this.loadCharacter(c.id))]);
  }
}

// One shared instance: the engine's Player and any future UI-side preview
// (e.g. CharacterSelect prefetching on hover) read from the same cache.
export const characterLoader = new CharacterLoader();
