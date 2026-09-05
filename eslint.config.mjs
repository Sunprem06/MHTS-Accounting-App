import nxEslintPlugin from '@nx/eslint-plugin';

export default [
  {
    plugins: {
      '@nx': nxEslintPlugin,
    },
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: [],
          depConstraints: [
            {
              // Rule #1 (CLAUDE.md): business logic packages must have zero
              // Electron/UI dependency. This makes that a lint failure, not a convention.
              sourceTag: 'type:core',
              onlyDependOnLibsWithTags: ['type:core', 'type:db', 'type:shared'],
            },
            {
              sourceTag: 'type:db',
              onlyDependOnLibsWithTags: ['type:shared'],
            },
            {
              sourceTag: 'type:shared',
              onlyDependOnLibsWithTags: ['type:shared'],
            },
            {
              sourceTag: 'type:app',
              onlyDependOnLibsWithTags: ['type:core', 'type:db', 'type:shared', 'type:app'],
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: (await import('@typescript-eslint/parser')).default,
    },
  },
];
