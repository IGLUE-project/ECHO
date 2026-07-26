// Build the app and package it into a ZIP for uploading to Escapp.
// The ZIP's root contains index.html (i.e. the *contents* of dist/), which is
// what the Escapp platform expects when you upload a puzzle app.
console.log("Task started: package app into a ZIP file.");

import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { existsSync, rmSync, mkdirSync } from "fs";
import { execSync } from "child_process";
import AdmZip from "adm-zip";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distFolder = resolve(__dirname, "../dist");
const zipFolder = resolve(__dirname, "../distZip");
const zipPath = join(zipFolder, "echo-app.zip");

// Clean previous build + zip output
if (existsSync(distFolder)) rmSync(distFolder, { recursive: true, force: true });
if (existsSync(zipFolder)) rmSync(zipFolder, { recursive: true, force: true });
mkdirSync(zipFolder, { recursive: true });

// Production build (relative base "./" — no VITE_BASE_PATH — so it works wherever
// Escapp serves it).
try {
  execSync("npm run build", { stdio: "inherit" });
} catch (err) {
  console.error("❌ Error during build:");
  console.error(err.message);
  process.exit(1);
}

// Zip the contents of dist/ (index.html ends up at the ZIP root)
const zip = new AdmZip();
zip.addLocalFolder(distFolder);
zip.writeZip(zipPath);

console.log("✅ Task finished. ZIP created at:", zipPath);
