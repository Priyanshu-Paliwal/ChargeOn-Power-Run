const fs = require("fs");

try {
  const file = fs.readFileSync(
    "d:/ChargeonOn Runner _ FINAL GAME/ChargeOn-Power-Run/public/assets/characters/male_character_ps1-style.glb",
  );
  const magic = file.toString("utf8", 0, 4);
  if (magic === "glTF") {
    const jsonLength = file.readUInt32LE(12);
    const jsonStr = file.toString("utf8", 20, 20 + jsonLength);
    const gltf = JSON.parse(jsonStr);

    console.log("Thalapathy Bones:");
    let boneCount = 0;
    for (const node of gltf.nodes) {
      if (node.name) {
        console.log(node.name);
        boneCount++;
        if (boneCount > 150) break;
      }
    }
  }
} catch (e) {
  console.error(e);
}
