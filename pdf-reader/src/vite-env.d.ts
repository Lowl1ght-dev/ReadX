/// <reference types="vite/client" />

declare module "three";

export interface ElectronAPI {
  openPdfDialog: (defaultPath?: string | null) => Promise<string | null>;
  readPdfFile: (filePath: string) => Promise<Uint8Array>;
  getPathForFile: (file: File) => string | null;
  platform: string;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
