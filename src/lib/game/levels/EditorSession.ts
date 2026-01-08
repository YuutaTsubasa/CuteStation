import type { LevelData } from "./LevelLoader";

let editorLevel: LevelData | null = null;

const cloneLevel = (level: LevelData): LevelData => {
  if (typeof structuredClone === "function") {
    return structuredClone(level);
  }
  return JSON.parse(JSON.stringify(level)) as LevelData;
};

export const EditorSession = {
  setEditorLevel(level: LevelData) {
    editorLevel = cloneLevel(level);
  },
  getEditorLevel() {
    return editorLevel ? cloneLevel(editorLevel) : null;
  },
  clearEditorLevel() {
    editorLevel = null;
  },
};
