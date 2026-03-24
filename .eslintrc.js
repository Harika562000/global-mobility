module.exports = {
  root: true,
  extends: [
    'airbnb-base',
    'plugin:json/recommended',
    'plugin:xwalk/recommended',
  ],
  env: {
    browser: true,
  },
  parser: '@babel/eslint-parser',
  parserOptions: {
    allowImportExportEverywhere: true,
    sourceType: 'module',
    requireConfigFile: false,
  },
  ignorePatterns: ['component-models.json'],
  rules: {
    'import/extensions': ['error', { js: 'always' }], // require js file extensions in imports
    'linebreak-style': ['error', 'unix'], // enforce unix linebreaks
    'no-param-reassign': [2, { props: false }], // allow modifying properties of param
    'xwalk/max-cells': 'off',
    'xwalk/no-duplicate-fields': 'off',
  },
  overrides: [
    {
      files: ['component-models.json'],
      rules: {
        'xwalk/max-cells': 'off',
        'xwalk/no-duplicate-fields': 'off',
        'xwalk/no-orphan-collapsible-fields': 'off',
      },
    },
  ],
};
