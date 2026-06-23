import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = process.cwd();
const requiredFiles = [
  "index.html",
  "public/site.webmanifest",
  "public/sw.js",
  "public/favicon.svg",
  "public/icon-180.png",
  "public/icon-192.png",
  "public/icon-512.png",
  "public/maskable-icon-512.png",
];

const requiredManifestIcons = [
  "./favicon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./maskable-icon-512.png",
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

for (const filePath of requiredFiles) {
  assert(existsSync(join(rootDir, filePath)), `Missing required PWA file: ${filePath}`);
}

const manifest = JSON.parse(readFileSync(join(rootDir, "public/site.webmanifest"), "utf8"));
const indexHtml = readFileSync(join(rootDir, "index.html"), "utf8");
const serviceWorker = readFileSync(join(rootDir, "public/sw.js"), "utf8");

assert(manifest.name === "RiftSync", "Manifest name must be RiftSync");
assert(manifest.short_name === "RiftSync", "Manifest short_name must be RiftSync");
assert(manifest.display === "standalone", "Manifest display must be standalone");
assert(manifest.start_url === "./", "Manifest start_url must be relative for GitHub Pages");
assert(manifest.scope === "./", "Manifest scope must be relative for GitHub Pages");
assert(Array.isArray(manifest.icons), "Manifest icons must be an array");

for (const iconSrc of requiredManifestIcons) {
  assert(
    manifest.icons.some((icon) => icon.src === iconSrc),
    `Manifest is missing icon entry: ${iconSrc}`,
  );
}

assert(
  manifest.icons.some((icon) => icon.src === "./maskable-icon-512.png" && icon.purpose === "maskable"),
  "Manifest must include a maskable 512px icon",
);
assert(indexHtml.includes('rel="manifest"'), "index.html must link the web manifest");
assert(indexHtml.includes('rel="apple-touch-icon"'), "index.html must link an Apple touch icon");
assert(indexHtml.includes('apple-mobile-web-app-capable'), "index.html must include iOS PWA metadata");
assert(serviceWorker.includes("CACHE_NAME"), "service worker must define a cache name");
assert(serviceWorker.includes("./site.webmanifest"), "service worker must cache the web manifest");
assert(serviceWorker.includes("./icon-192.png"), "service worker must cache the 192px icon");
assert(serviceWorker.includes("./maskable-icon-512.png"), "service worker must cache the maskable icon");
assert(serviceWorker.includes("./docs/"), "service worker must leave MkDocs pages outside the PWA cache handler");

console.log("RiftSync PWA asset validation passed.");
