import createEmotion from '@emotion/css/create-instance';

/** Preserve CAM's cache key, plugin list and compat insertion policy with one shared npm cache. */
export const { cache: styleCache } = createEmotion({
  key: 'cam-style',
  stylisPlugins: [],
});
