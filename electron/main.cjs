const { app, BrowserWindow, globalShortcut } = require("electron");
const path = require("path");

// Enable hardware acceleration and GPU flags for WebGL game performance
app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");

let mainWindow = null;

function createWindow() {
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
    },
  });

  const isDev = !app.isPackaged || process.env.NODE_ENV === "development";
  const devUrl = process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";

  if (isDev) {
    // In dev mode, load the Vite local dev server for instant HMR hot-reloading
    mainWindow.loadURL(devUrl).catch(() => {
      console.log("[Electron] Waiting for Vite dev server...");
      setTimeout(() => mainWindow.loadURL(devUrl), 1000);
    });
  } else {
    // In production build, load the compiled dist files
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  // Keyboard shortcuts: F11 toggle fullscreen, ESC exit fullscreen
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.key === "F11" && input.type === "keyDown") {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      event.preventDefault();
    } else if (input.key === "Escape" && input.type === "keyDown" && mainWindow.isFullScreen()) {
      mainWindow.setFullScreen(false);
      event.preventDefault();
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
  if (process.platform !== "darwin") {
    app.quit();
  }
});
