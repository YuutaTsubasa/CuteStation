import manifest from "./assetManifest.json";

export type AssetManifest = typeof manifest;

export const assetManifest: AssetManifest = manifest;

export const getSpriteSheetPaths = (path: string) => {
  return {
    json: path,
    image: path.replace(/\.json$/, ".webp"),
  };
};
