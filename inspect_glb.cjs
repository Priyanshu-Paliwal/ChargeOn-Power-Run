const fs = require('fs');
const path = require('path');

function inspectGLB(filePath) {
    const buffer = fs.readFileSync(filePath);
    const magic = buffer.readUInt32LE(0);
    if (magic !== 0x46546C67) { // 'glTF'
        console.error("Not a valid GLB file.");
        return;
    }
    
    const version = buffer.readUInt32LE(4);
    const length = buffer.readUInt32LE(8);
    
    const chunkLength = buffer.readUInt32LE(12);
    const chunkType = buffer.readUInt32LE(16);
    
    if (chunkType !== 0x4E4F534A) { // 'JSON'
        console.error("First chunk is not JSON.");
        return;
    }
    
    const jsonBuffer = buffer.slice(20, 20 + chunkLength);
    const jsonString = jsonBuffer.toString('utf8');
    const gltf = JSON.parse(jsonString);
    
    console.log("=== GLTF JSON ===");
    console.log("Nodes:");
    gltf.nodes.forEach((n, i) => {
        let transformStr = "";
        if (n.translation) transformStr += `pos:[${n.translation.map(v => v.toFixed(3)).join(', ')}] `;
        if (n.rotation) transformStr += `rot:[${n.rotation.map(v => v.toFixed(3)).join(', ')}] `;
        if (n.scale) transformStr += `scale:[${n.scale.map(v => v.toFixed(3)).join(', ')}]`;
        console.log(`  [${i}] ${n.name || 'Unnamed'} - ${transformStr}`);
    });
    
    console.log("\nMeshes:");
    if (gltf.meshes) {
        gltf.meshes.forEach((m, i) => {
            console.log(`  [${i}] ${m.name || 'Unnamed'}`);
        });
    }

    console.log("\nMaterials:");
    if (gltf.materials) {
        gltf.materials.forEach((m, i) => {
            console.log(`  [${i}] ${m.name || 'Unnamed'}`);
            if (m.pbrMetallicRoughness && m.pbrMetallicRoughness.baseColorFactor) {
                console.log(`    Color: ${m.pbrMetallicRoughness.baseColorFactor}`);
            }
        });
    }

    console.log("\nAccessors (Position Bounds):");
}

const targetFile = process.argv[2] || path.join(__dirname, 'public/assets/characters/professional_male_causual_dress.glb');
inspectGLB(targetFile);
