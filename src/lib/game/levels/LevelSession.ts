import type { LevelData } from "./LevelLoader";

let previewLevel: LevelData | null = null;

const cloneLevel = (level: LevelData): LevelData => {
  if (typeof structuredClone === "function") {
    return structuredClone(level);
  }
  return JSON.parse(JSON.stringify(level)) as LevelData;
};

export const LevelSession = {
  setPreviewLevel(level: LevelData) {
    previewLevel = cloneLevel(level);
  },
  getPreviewLevel() {
    return previewLevel ? cloneLevel(previewLevel) : null;
  },
  clearPreviewLevel() {
    previewLevel = null;
  },
};
