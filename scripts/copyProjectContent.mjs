import { cp, rm } from "node:fs/promises";
import path from "node:path";

const source = path.resolve("ProjectContent");
const target = path.resolve("static", "ProjectContent");

await rm(target, { recursive: true, force: true });
await cp(source, target, { recursive: true });

console.log(`Copied ${source} -> ${target}`);
