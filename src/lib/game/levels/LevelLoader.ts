export type LevelRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type LevelPoint = {
  id: string;
  x: number;
  y: number;
};

export type LevelData = {
  levelId: string;
  name: string;
  version: number;
  world: {
    width: number;
    height: number;
  };
  spawn: {
    x: number;
    y: number;
  };
  solids: LevelRect[];
  goal: LevelRect;
  coins: LevelPoint[];
};

export async function loadLevel(path: string): Promise<LevelData> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load level: ${response.status} ${path}`);
  }

  return (await response.json()) as LevelData;
}
