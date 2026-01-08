export type VisualsConfig = {
  groundHeight: number;
  parallax: {
    far: number;
    mid: number;
    near?: number;
    midYScale?: number;
  };
  layers?: {
    nearEnabled?: boolean;
  };
};

export function normalizeVisualsConfig(config: VisualsConfig): VisualsConfig {
  return {
    groundHeight: config.groundHeight,
    parallax: {
      far: config.parallax.far,
      mid: config.parallax.mid,
      near: config.parallax.near,
      midYScale: config.parallax.midYScale ?? 1,
    },
    layers: {
      nearEnabled: config.layers?.nearEnabled ?? false,
    },
  };
}
