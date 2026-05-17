import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const exe = path.join(root, "release", "win-unpacked", "ReadX.exe");
const ico = path.join(root, "build", "icon.ico");
const appBuilder = path.join(root, "node_modules", "app-builder-bin", "win", "x64", "app-builder.exe");

if (!fs.existsSync(exe) || !fs.existsSync(ico)) {
  console.warn("[embed-exe-icon] Skip: exe or icon.ico not found");
  process.exit(0);
}

if (!fs.existsSync(appBuilder)) {
  console.warn("[embed-exe-icon] Skip: app-builder not found");
  process.exit(0);
}

const args = [
  exe,
  "--set-icon",
  ico,
  "--set-version-string",
  "ProductName",
  "ReadX",
  "--set-file-version",
  "1.0.0",
  "--set-product-version",
  "1.0.0.0",
];

try {
  execFileSync(appBuilder, ["rcedit", "--args", JSON.stringify(args)], { stdio: "inherit" });
  console.log("[embed-exe-icon] Icon embedded in ReadX.exe");
} catch {
  console.warn("[embed-exe-icon] Could not embed (network/cache). Window icon still works via extraResources.");
}
