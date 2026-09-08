import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from '../../tools/vitest/base.config.mts';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      name: 'core-expense',
      root: import.meta.dirname,
    },
  }),
);
