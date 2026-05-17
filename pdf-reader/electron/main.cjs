const { app, BrowserWindow, ipcMain, dialog, nativeTheme, Menu } = require("electron");
const fs = require("fs");
const fsp = require("fs").promises;
const path = require("path");

const isDev = !app.isPackaged && Boolean(process.env.VITE_DEV_SERVER_URL);

function resolveIndexHtml() {
  return path.join(__dirname, "..", "dist", "index.html");
}

function resolveAppIcon() {
  if (app.isPackaged) {
    const bundled = path.join(process.resourcesPath, "icon.png");
    if (fs.existsSync(bundled)) return bundled;
  }
  const devPng = path.join(__dirname, "..", "build", "icon.png");
  if (fs.existsSync(devPng)) return devPng;
  return undefined;
}

function createWindow() {
  nativeTheme.themeSource = "system";
  Menu.setApplicationMenu(null);

  const appIcon = resolveAppIcon();

  const win = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: 640,
    minHeight: 480,
    title: "ReadX",
    icon: appIcon,
    backgroundColor: "#0f1115",
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.setMenuBarVisibility(false);

  win.once("ready-to-show", () => {
    win.show();
  });

  if (isDev) {
    void win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    void win.loadFile(resolveIndexHtml());
  }

  win.webContents.on("did-fail-load", (_event, code, description, url) => {
    console.error("[ReadX] did-fail-load", code, description, url);
  });
}

ipcMain.handle("dialog:openPdf", async (_event, defaultPath) => {
  const opts = {
    title: "Открыть PDF",
    properties: ["openFile"],
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  };
  if (typeof defaultPath === "string" && defaultPath.length > 0) {
    opts.defaultPath = defaultPath;
  }
  const { canceled, filePaths } = await dialog.showOpenDialog(opts);
  if (canceled || !filePaths[0]) return null;
  return filePaths[0];
});

ipcMain.handle("pdf:readFile", async (_event, filePath) => {
  if (typeof filePath !== "string" || !filePath.toLowerCase().endsWith(".pdf")) {
    throw new Error("Invalid file");
  }
  return await fsp.readFile(filePath);
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
