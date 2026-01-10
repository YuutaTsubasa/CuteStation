import { readdirSync, statSync } from "node:fs";
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

  console.log(
    `WebP conversion done. Converted ${converted}, skipped ${skipped}.`,
  );
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
