import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const modelsDir = path.resolve(__dirname, '../public/models');
const texturesDir = path.resolve(__dirname, '../public/textures');

if (!fs.existsSync(modelsDir)) fs.mkdirSync(modelsDir, { recursive: true });
if (!fs.existsSync(texturesDir)) fs.mkdirSync(texturesDir, { recursive: true });

const assets = [
  { url: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/Soldier.glb', dest: path.join(modelsDir, 'Soldier.glb') },
  { url: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/equirectangular/venice_sunset_1k.hdr', dest: path.join(texturesDir, 'venice_sunset_1k.hdr') },
  { url: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/terrain/grasslight-big.jpg', dest: path.join(texturesDir, 'grass_diffuse.jpg') },
  { url: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/terrain/grasslight-big-nm.jpg', dest: path.join(texturesDir, 'grass_normal.jpg') },
  { url: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/waternormals.jpg', dest: path.join(texturesDir, 'asphalt_normal.jpg') } // We'll tile this heavily for road grit
];

// Downloads a single URL to `dest`, following redirects, and rejects on any
// non-2xx final status instead of writing the response body (which for a 404
// is an HTML/text error page, not the asset) to disk.
//
// This function exists because the previous version of this script piped
// every response straight to file regardless of status code. One of the
// URLs above 404'd at some point after this script was last run, and the
// 404 page's body was silently saved as grass_normal.jpg -- a 14-byte file
// containing the literal text "404: Not Found" -- where it sat undetected
// until the Milestone 1 asset audit. See docs/IMPLEMENTATION_PLAN.md.
function download(url, dest, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      const { statusCode } = response;

      if (statusCode >= 300 && statusCode < 400 && response.headers.location) {
        response.resume(); // discard this response body
        if (redirectsLeft <= 0) {
          reject(new Error(`Too many redirects fetching ${url}`));
          return;
        }
        download(response.headers.location, dest, redirectsLeft - 1).then(resolve, reject);
        return;
      }

      if (statusCode < 200 || statusCode >= 300) {
        response.resume(); // discard body, do not write it to disk
        reject(new Error(`HTTP ${statusCode} fetching ${url}`));
        return;
      }

      const file = fs.createWriteStream(dest);
      response.pipe(file);
      file.on('finish', () => {
        file.close(() => resolve());
      });
      file.on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    }).on('error', reject);
  });
}

async function main() {
  let failed = false;
  for (const asset of assets) {
    console.log(`Downloading ${asset.url}...`);
    try {
      await download(asset.url, asset.dest);
      console.log(`  OK -> ${asset.dest}`);
    } catch (err) {
      failed = true;
      console.error(`  FAILED: ${err.message}`);
    }
  }
  if (failed) {
    console.error('\nOne or more downloads failed. See errors above -- no partial/error-page files were written for them.');
    process.exit(1);
  }
}

main();
