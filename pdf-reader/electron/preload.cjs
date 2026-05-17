const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  openPdfDialog: (defaultPath) => ipcRenderer.invoke("dialog:openPdf", defaultPath ?? null),
  readPdfFile: (filePath) => ipcRenderer.invoke("pdf:readFile", filePath),
  getPathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file);
    } catch {
      return null;
    }
  },
  platform: process.platform,
});
