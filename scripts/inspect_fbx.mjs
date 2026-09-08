import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import fs from "fs";

const loader = new FBXLoader();

const files = [
  "Victory_idle.fbx",
  "victory_jump.fbx",
  "Defeat.fbx",
  "Defeated.fbx",
];

for (const file of files) {
  const buf = fs.readFileSync(`public/assets/characters/motions/${file}`);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  try {
    const fbx = loader.parse(ab, "");
    console.log(`=== ${file} ===`);
    console.log("Animations count:", fbx.animations?.length);
    if (fbx.animations && fbx.animations.length > 0) {
      const clip = fbx.animations[0];
      console.log(
        "Clip name:",
        clip.name,
        "Duration:",
        clip.duration.toFixed(2),
        "s",
        "Tracks:",
        clip.tracks.length,
      );
      const posTracks = clip.tracks.filter((t) => t.name.endsWith(".position"));
      console.log(
        "Position tracks:",
        posTracks.map((t) => t.name),
      );
    }
  } catch (err) {
    console.error(`Error parsing ${file}:`, err.message);
  }
}
