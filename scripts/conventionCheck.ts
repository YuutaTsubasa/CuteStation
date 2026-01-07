import fs from "node:fs/promises";
import path from "node:path";

const EXCLUDED_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  ".svelte-kit",
  ".git",
  "target",
  "reports",
]);

const INTERNAL_ROOTS = ["src", "scripts", "tests"];
const ASSET_EXCLUDED_PREFIXES = ["src-tauri/", "static/"];

const ASSET_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webp",
  ".mp3",
  ".wav",
  ".ogg",
  ".mp4",
  ".ttf",
  ".otf",
  ".glb",
  ".gltf",
  ".ase",
  ".aseprite",
  ".psd",
  ".atlas",
]);

const ALLOWED_NAME_PATTERNS = [
  /^package\.json$/i,
  /^readme(\..+)?$/i,
  /^tauri\.conf\.json$/i,
  /^vite\.config\.[a-z0-9]+$/i,
  /^tsconfig(\..+)?\.json$/i,
  /^svelte\.config\.[a-z0-9]+$/i,
];

type Severity = "error" | "warn" | "info";

type Issue = {
  severity: Severity;
  ruleId: string;
  path: string;
  message: string;
  suggestedFix?: string;
};

type Report = {
  schemaVersion: number;
  summary: {
    checkedAt: string;
    errors: number;
    warnings: number;
    info: number;
    canonicalAssetRoot: string;
  };
  issues: Issue[];
};

const rootDir = process.cwd();

function toPosix(p: string) {
  return p.split(path.sep).join("/");
}

function isUnder(relPath: string, base: string) {
  return relPath === base || relPath.startsWith(`${base}/`);
}

function isInternalPath(relPath: string) {
  return INTERNAL_ROOTS.some((base) => isUnder(relPath, base));
}

function hasDisallowedNameChars(name: string) {
  return name.includes("-") || name.includes("_");
}

function isAllowedName(name: string) {
  return ALLOWED_NAME_PATTERNS.some((pattern) => pattern.test(name));
}

function isPascalCase(name: string) {
  return /^[A-Z][A-Za-z0-9]*$/.test(name);
}

function isRouteFile(name: string) {
  return name.startsWith("+");
}

async function pathExists(candidate: string) {
  try {
    await fs.access(candidate);
    return true;
  } catch {
    return false;
  }
}

async function walkDir(dir: string, files: string[], dirs: string[]) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) {
        continue;
      }
      dirs.push(fullPath);
      await walkDir(fullPath, files, dirs);
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
}

function addIssue(issues: Issue[], issue: Issue) {
  issues.push(issue);
}

async function main() {
  const files: string[] = [];
  const dirs: string[] = [];
  await walkDir(rootDir, files, dirs);

  const issues: Issue[] = [];

  const canonicalAssetRoot = (await pathExists(path.join(rootDir, "ProjectContent")))
    ? "ProjectContent"
    : (await pathExists(path.join(rootDir, "ProjectContents")))
      ? "ProjectContents"
      : "ProjectContent";
  const canonicalAssetExists = await pathExists(
    path.join(rootDir, canonicalAssetRoot),
  );

  if (!canonicalAssetExists) {
    addIssue(issues, {
      severity: "warn",
      ruleId: "assets/missing-canonical-root",
      path: canonicalAssetRoot,
      message:
        "Canonical asset root is missing; assets should be moved under it.",
      suggestedFix: `Create ${canonicalAssetRoot}/ and move assets there.`,
    });
  }

  for (const dirPath of dirs) {
    const relPath = toPosix(path.relative(rootDir, dirPath));
    const dirName = path.basename(dirPath);

    if (isInternalPath(relPath) && hasDisallowedNameChars(dirName)) {
      addIssue(issues, {
        severity: "error",
        ruleId: "naming/no-hyphen-underscore",
        path: relPath,
        message: "Internal code directories must not include '-' or '_' in names.",
        suggestedFix: `Rename to camelCase or PascalCase.`,
      });
    }

    if (
      isInternalPath(relPath) &&
      ["temp", "tmp"].includes(dirName.toLowerCase())
    ) {
      addIssue(issues, {
        severity: "warn",
        ruleId: "structure/no-temp-dirs",
        path: relPath,
        message: "Temporary folders under internal code roots are not allowed.",
        suggestedFix: "Remove or relocate the temp folder outside src/scripts/tests.",
      });
    }
  }

  for (const filePath of files) {
    const relPath = toPosix(path.relative(rootDir, filePath));
    const fileName = path.basename(filePath);
    const extension = path.extname(fileName).toLowerCase();

    if (isInternalPath(relPath) && hasDisallowedNameChars(fileName)) {
      if (!isAllowedName(fileName)) {
        addIssue(issues, {
          severity: "error",
          ruleId: "naming/no-hyphen-underscore",
          path: relPath,
          message: "Internal code files must not include '-' or '_' in names.",
          suggestedFix: "Rename to camelCase or PascalCase.",
        });
      }
    }

    if (extension === ".svelte") {
      if (!isRouteFile(fileName)) {
        const baseName = fileName.replace(/\.svelte$/i, "");
        if (!isPascalCase(baseName)) {
          addIssue(issues, {
            severity: "error",
            ruleId: "svelte/pascalcase-components",
            path: relPath,
            message: "Svelte component filenames must be PascalCase.",
            suggestedFix: `Rename to PascalCase, e.g. ${
              baseName
                ? `${baseName[0].toUpperCase()}${baseName.slice(1)}`
                : "MyComponent"
            }.svelte`,
          });
        }
      }
    }

    if (ASSET_EXTENSIONS.has(extension)) {
      if (ASSET_EXCLUDED_PREFIXES.some((prefix) => relPath.startsWith(prefix))) {
        continue;
      }
      const canonicalRootPath = `${canonicalAssetRoot}/`;
      if (!relPath.startsWith(canonicalRootPath)) {
        addIssue(issues, {
          severity: "error",
          ruleId: "assets/location",
          path: relPath,
          message: `Assets must live under ${canonicalAssetRoot}/`,
          suggestedFix: `Move to ${canonicalAssetRoot}/${path.basename(relPath)}`,
        });
      }
    }
  }

  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.filter((issue) => issue.severity === "warn").length;
  const info = issues.filter((issue) => issue.severity === "info").length;

  const report: Report = {
    schemaVersion: 1,
    summary: {
      checkedAt: new Date().toISOString(),
      errors,
      warnings,
      info,
      canonicalAssetRoot,
    },
    issues,
  };

  await fs.mkdir(path.join(rootDir, "reports"), { recursive: true });
  await fs.writeFile(
    path.join(rootDir, "reports", "convention-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf-8",
  );

  const markdownLines: string[] = [
    "# Convention Report",
    "",
    `Generated: ${report.summary.checkedAt}`,
    "",
    `- Errors: ${errors}`,
    `- Warnings: ${warnings}`,
    `- Info: ${info}`,
    `- Canonical asset root: ${canonicalAssetRoot}`,
    "",
  ];

  if (issues.length === 0) {
    markdownLines.push("No issues found.");
  } else {
    markdownLines.push("## Issues", "");
    for (const issue of issues) {
      const fixText = issue.suggestedFix
        ? ` Suggested fix: ${issue.suggestedFix}`
        : "";
      markdownLines.push(
        `- [${issue.severity}] ${issue.ruleId} ${issue.path} - ${issue.message}${fixText}`,
      );
    }
  }

  await fs.writeFile(
    path.join(rootDir, "reports", "convention-report.md"),
    `${markdownLines.join("\n")}\n`,
    "utf-8",
  );

  const modeArg = process.argv.find((arg) => arg.startsWith("--mode="));
  const mode = modeArg ? modeArg.split("=")[1] : "check";
  if (mode !== "report" && errors > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Convention check failed:", error);
  process.exit(1);
});
