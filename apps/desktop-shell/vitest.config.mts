import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from '../../tools/vitest/base.config.mts';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      name: 'desktop-shell',
      root: import.meta.dirname,
    },
  }),
);
