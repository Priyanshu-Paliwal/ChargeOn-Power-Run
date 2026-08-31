import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { draco, dedup, prune, textureCompress } from "@gltf-transform/functions";
import draco3d from "draco3dgltf";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.resolve(__dirname, "../public");
const CHARACTERS_DIR = path.join(PUBLIC, "assets/characters");

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(walk(full));
    } else if (entry.isFile() && full.endsWith(".glb")) {
      files.push({ path: full, size: fs.statSync(full).size });
    }
  }
  return files;
}

async function main() {
  console.log("Initializing gltf-transform with Draco...");
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      "draco3d.decoder": await draco3d.createDecoderModule(),
      "draco3d.encoder": await draco3d.createEncoderModule(),
    });

  const allFiles = walk(CHARACTERS_DIR);
  // Only process files > 1.5 MB to avoid re-compressing already optimized files
  const toProcess = allFiles.filter(f => f.size > 1.5 * 1024 * 1024);

  for (const file of toProcess) {
    const relPath = path.relative(PUBLIC, file.path);
    console.log(`\nOptimizing ${relPath} (Initial size: ${(file.size / 1024 / 1024).toFixed(2)} MB)...`);
    
    try {
      const doc = await io.read(file.path);
      
      await doc.transform(
        dedup(),
        prune(),
        textureCompress({ encoder: sharp, targetFormat: "webp", resize: [1024, 1024] }), // Compress massive embedded textures
        draco() // Applies Draco geometry compression
      );
      
      await io.write(file.path, doc);
      
      const newSize = fs.statSync(file.path).size;
      console.log(`Finished ${relPath} (New size: ${(newSize / 1024 / 1024).toFixed(2)} MB)`);
    } catch (e) {
      console.error(`Failed to optimize ${relPath}:`, e.message);
    }
  }
  
  console.log("\nAll optimizations complete!");
}

main().catch(console.error);
