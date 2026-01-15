import { assetManifest } from "../assets/AssetManifest";

export type EnemyHitbox = {
  width: number;
  height: number;
};

export type EnemyDefinition = {
  id: string;
  displayName: string;
  assetId: keyof typeof assetManifest.enemies;
  behavior: "idle" | "patrol";
  patrolRange: number;
  patrolSpeed: number;
  idleDuration: number;
  gravityEnabled: boolean;
  hitbox: EnemyHitbox;
  spriteScaleMultiplier: number;
  visualOffsetY: number;
};

export type EnemyCatalog = Record<string, EnemyDefinition>;

type EnemyCatalogPayload = {
  enemies?: Record<string, Partial<EnemyDefinition>>;
};

const fallbackCatalog: EnemyCatalog = {
  slime: {
    id: "slime",
    displayName: "Slime",
    assetId: "slime",
    behavior: "patrol",
    patrolRange: 96,
    patrolSpeed: 80,
    idleDuration: 0.5,
    gravityEnabled: true,
    hitbox: { width: 64, height: 52 },
    spriteScaleMultiplier: 1.5,
    visualOffsetY: 17.3,
  },
  crystal: {
    id: "crystal",
    displayName: "Crystal",
    assetId: "crystal",
    behavior: "idle",
    patrolRange: 0,
    patrolSpeed: 0,
    idleDuration: 0.5,
    gravityEnabled: false,
    hitbox: { width: 33, height: 79 },
    spriteScaleMultiplier: 2,
    visualOffsetY: 25,
  },
};

let cachedCatalog: EnemyCatalog | null = null;
let loadingCatalog: Promise<EnemyCatalog> | null = null;

const normalizeDefinition = (
  id: string,
  definition: Partial<EnemyDefinition>,
): EnemyDefinition => {
  const fallback = fallbackCatalog[id] ?? fallbackCatalog.slime;
  const hitbox = definition.hitbox ?? fallback.hitbox;
  return {
    id,
    displayName: definition.displayName ?? fallback.displayName ?? id,
    assetId: (definition.assetId ?? fallback.assetId) as EnemyDefinition["assetId"],
    behavior: definition.behavior ?? fallback.behavior ?? "idle",
    patrolRange: definition.patrolRange ?? fallback.patrolRange ?? 0,
    patrolSpeed: definition.patrolSpeed ?? fallback.patrolSpeed ?? 0,
    idleDuration: definition.idleDuration ?? fallback.idleDuration ?? 0,
    gravityEnabled: definition.gravityEnabled ?? fallback.gravityEnabled ?? true,
    hitbox: {
      width: hitbox.width ?? fallback.hitbox.width,
      height: hitbox.height ?? fallback.hitbox.height,
    },
    spriteScaleMultiplier:
      definition.spriteScaleMultiplier ?? fallback.spriteScaleMultiplier ?? 1,
    visualOffsetY: definition.visualOffsetY ?? fallback.visualOffsetY ?? 0,
  };
};

export const loadEnemyCatalog = async (): Promise<EnemyCatalog> => {
  if (cachedCatalog) {
    return cachedCatalog;
  }
  if (loadingCatalog) {
    return loadingCatalog;
  }

  loadingCatalog = (async () => {
    const configPath = assetManifest.enemyConfig;
    if (!configPath) {
      cachedCatalog = fallbackCatalog;
      return cachedCatalog;
    }

    try {
      const response = await fetch(configPath);
      if (!response.ok) {
        cachedCatalog = fallbackCatalog;
        return cachedCatalog;
      }
      const payload = (await response.json()) as EnemyCatalogPayload;
      const entries = payload.enemies ?? {};
      const catalog: EnemyCatalog = {};
      for (const [id, definition] of Object.entries(entries)) {
        catalog[id] = normalizeDefinition(id, definition ?? {});
      }
      if (!catalog.slime) {
        catalog.slime = fallbackCatalog.slime;
      }
      cachedCatalog = { ...fallbackCatalog, ...catalog };
      return cachedCatalog;
    } catch {
      cachedCatalog = fallbackCatalog;
      return cachedCatalog;
    }
  })();

  return loadingCatalog;
};

export const getEnemyCatalogSync = () => cachedCatalog ?? fallbackCatalog;
