import { readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import sharp from "sharp";

const args = process.argv.slice(2);
const getArgValue = (name, fallback) => {
  const index = args.indexOf(name);
  if (index === -1 || index + 1 >= args.length) {
    return fallback;
  }
  return args[index + 1];
};

const root = resolve(getArgValue("--root", "ProjectContent"));
const quality = Number(getArgValue("--quality", "82"));
const force = args.includes("--force");

const supportedExt = new Set([".png", ".jpg", ".jpeg"]);

const walkFiles = (dir, entries) => {
  for (const name of readdirSync(dir)) {
    const fullPath = join(dir, name);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walkFiles(fullPath, entries);
      continue;
    }
    const ext = extname(fullPath).toLowerCase();
    if (supportedExt.has(ext)) {
      entries.push(fullPath);
    }
  }
};

const toWebpPath = (filePath) => filePath.replace(/\.[^.]+$/, ".webp");

const imageExtensions = new Set([".png", ".jpg", ".jpeg"]);

const rewriteKey = (key) => {
  const ext = extname(key).toLowerCase();
  if (imageExtensions.has(ext)) {
    return key.replace(/\.[^.]+$/, ".webp");
  }
  return key;
};

const rewriteImageExtensions = (value) => {
  if (typeof value === "string") {
    const ext = extname(value).toLowerCase();
    if (imageExtensions.has(ext)) {
      return value.replace(/\.[^.]+$/, ".webp");
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => rewriteImageExtensions(entry));
  }
  if (value && typeof value === "object") {
    const updated = {};
    for (const [key, entry] of Object.entries(value)) {
      const nextKey = rewriteKey(key);
      updated[nextKey] = rewriteImageExtensions(entry);
    }
    return updated;
  }
  return value;
};

const updateJsonFile = (filePath) => {
  const raw = readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw);
  const next = rewriteImageExtensions(data);
  const nextRaw = JSON.stringify(next, null, 2) + "\n";
  if (nextRaw !== raw) {
    writeFileSync(filePath, nextRaw, "utf-8");
  }
};

const updateSpritesheets = (dir) => {
  for (const name of readdirSync(dir)) {
    const fullPath = join(dir, name);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      updateSpritesheets(fullPath);
      continue;
    }
    if (extname(fullPath).toLowerCase() === ".json") {
      updateJsonFile(fullPath);
    }
  }
};

const updateAssetManifest = () => {
  const manifestPath = resolve("src/lib/game/assets/assetManifest.json");
  updateJsonFile(manifestPath);
};

const run = async () => {
  const files = [];
  walkFiles(root, files);

  let converted = 0;
  let skipped = 0;

  for (const filePath of files) {
    const outputPath = toWebpPath(filePath);
    if (!force) {
      try {
        statSync(outputPath);
        skipped += 1;
        continue;
      } catch {
        // Output does not exist yet.
      }
    }
    await sharp(filePath).webp({ quality }).toFile(outputPath);
    converted += 1;
  }

  updateSpritesheets(root);
  updateAssetManifest();

  let removed = 0;
  for (const filePath of files) {
    const outputPath = toWebpPath(filePath);
    try {
      statSync(outputPath);
      unlinkSync(filePath);
      removed += 1;
    } catch {
      // Skip removal if output missing.
    }
  }

  console.log(
    `WebP conversion done. Converted ${converted}, skipped ${skipped}, removed ${removed}.`,
  );
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
