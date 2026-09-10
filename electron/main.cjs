const { app, BrowserWindow, globalShortcut } = require("electron");
const path = require("path");
const http = require("http");
const fs = require("fs");

// Enable Dedicated High-Performance GPU and WebGL hardware acceleration
app.commandLine.appendSwitch("force_high_performance_gpu");
app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("disable-renderer-backgrounding");

// Set application name
app.setName("ChargeOn Power Run");

const MIME_MAP = {
  ".html": "text/html; charset=UTF-8",
  ".js": "application/javascript; charset=UTF-8",
  ".mjs": "application/javascript; charset=UTF-8",
  ".css": "text/css; charset=UTF-8",
  ".json": "application/json; charset=UTF-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".fbx": "application/octet-stream",
  ".bin": "application/octet-stream",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

let localServer = null;

function startStaticServer(distDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(req.url.split("?")[0]);
      let safePath = path.normalize(urlPath).replace(/^(\.\.[\/\\])+/, "");
      if (safePath === "/" || safePath === "\\" || safePath === ".") {
        safePath = "/index.html";
      }

      const filePath = path.join(distDir, safePath);

      fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
          const indexPath = path.join(distDir, "index.html");
          fs.stat(indexPath, (idxErr, idxStats) => {
            if (idxErr || !idxStats.isFile()) {
              res.statusCode = 404;
              res.end("Not Found");
              return;
            }
            res.setHeader("Content-Type", "text/html; charset=UTF-8");
            fs.createReadStream(indexPath).pipe(res);
          });
          return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_MAP[ext] || "application/octet-stream";
        const totalSize = stats.size;

        const range = req.headers.range;
        if (range) {
          const parts = range.replace(/bytes=/, "").split("-");
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

          if (start >= totalSize || end >= totalSize) {
            res.statusCode = 416;
            res.setHeader("Content-Range", `bytes */${totalSize}`);
            res.end();
            return;
          }

          res.statusCode = 206;
          res.setHeader("Content-Range", `bytes ${start}-${end}/${totalSize}`);
          res.setHeader("Accept-Ranges", "bytes");
          res.setHeader("Content-Length", end - start + 1);
          res.setHeader("Content-Type", contentType);
          res.setHeader("Access-Control-Allow-Origin", "*");

          fs.createReadStream(filePath, { start, end }).pipe(res);
        } else {
          res.statusCode = 200;
          res.setHeader("Content-Length", totalSize);
          res.setHeader("Content-Type", contentType);
          res.setHeader("Accept-Ranges", "bytes");
          res.setHeader("Access-Control-Allow-Origin", "*");

          fs.createReadStream(filePath).pipe(res);
        }
      });
    });

    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      resolve({ server, port, url: `http://127.0.0.1:${port}` });
    });

    server.on("error", reject);
  });
}

let mainWindow = null;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    fullscreen: true,
    autoHideMenuBar: true,
    title: "ChargeOn Power Run",
    icon: path.join(__dirname, "../public/img/chargeon-logo-badge-hd.png"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      backgroundThrottling: false,
    },
  });

  const isDev = !app.isPackaged && process.env.NODE_ENV !== "production";
  const devUrl = process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";
  const distDir = path.join(app.getAppPath(), "dist");

  if (isDev) {
    // In dev mode, load the Vite local dev server for instant HMR hot-reloading
    mainWindow.loadURL(devUrl).catch(() => {
      console.log("[Electron] Waiting for Vite dev server...");
      setTimeout(() => mainWindow.loadURL(devUrl), 1000);
    });
  } else {
    // In production build, serve dist via high-performance local loopback server
    // to guarantee /assets, /img, /textures, and Draco WASM load seamlessly
    try {
      const { server, url } = await startStaticServer(distDir);
      localServer = server;
      mainWindow.loadURL(url);
    } catch (err) {
      console.error("[Electron] Failed to start local server, fallback to file:", err);
      mainWindow.loadFile(path.join(distDir, "index.html"));
    }
  }

  // Cross-platform keyboard shortcuts:
  // F11: Toggle Fullscreen
  // Cmd+F or Cmd+Ctrl+F: Fullscreen on macOS
  // ESC: Exit Fullscreen
  // F12 or Cmd+Option+I / Ctrl+Shift+I: Toggle DevTools
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.type === "keyDown") {
      const isF11 = input.key === "F11";
      const isMacFullscreen = (input.meta || input.control) && input.key.toLowerCase() === "f";
      const isDevTools =
        input.key === "F12" ||
        ((input.meta || input.control) && input.shift && input.key.toLowerCase() === "i");

      if (isDevTools) {
        mainWindow.webContents.toggleDevTools();
        event.preventDefault();
      } else if (isF11 || isMacFullscreen) {
        mainWindow.setFullScreen(!mainWindow.isFullScreen());
        event.preventDefault();
      } else if (input.key === "Escape" && mainWindow.isFullScreen()) {
        mainWindow.setFullScreen(false);
        event.preventDefault();
      }
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (localServer) {
    localServer.close();
  }
  app.quit();
});

app.on("will-quit", () => {
  if (localServer) {
    localServer.close();
  }
});


