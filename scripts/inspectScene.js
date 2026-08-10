import puppeteer from 'puppeteer';

async function run() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  
  try {
    await page.goto('http://localhost:5175', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await new Promise(r => setTimeout(r, 15000)); // wait for game to init
    
    const result = await page.evaluate(() => {
      if (!window.scene) return "scene not found";
      
      const meshes = window.scene.children.filter(c => c.isInstancedMesh);
      let info = `Scene children: ${window.scene.children.length}\n`;
      info += `InstancedMeshes in scene: ${meshes.length}\n`;
      for (const m of meshes) {
        info += `  Mesh: count=${m.count}, visible=${m.visible}, position=${m.position.toArray()}\n`;
      }
      
      if (!window.sceneryInstancer) return info + "\nSceneryInstancer not found";
      
      const si = window.sceneryInstancer;
      info += `\nSceneryInstancer pools: ${Object.keys(si.pools).length}\n`;
      for (const poolName in si.pools) {
        const pool = si.pools[poolName];
        info += `  Pool ${poolName}: parts=${pool.parts.length}\n`;
        const mesh = pool.parts[0].mesh;
        info += `    Mesh count=${mesh.count}\n`;
      }
      return info;
    });
    
    console.log("SCENE INSPECTION:\n", result);
    
  } catch(e) {
    console.log('Timeout or error:', e.message);
  }
  
  await browser.close();
}

run();
