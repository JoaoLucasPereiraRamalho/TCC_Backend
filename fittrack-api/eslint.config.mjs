// @ts-check
import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Regra 6 dos testes de arquitetura (docs/estrutura-de-pastas-e-modulos.md, seção 5):
 * só `platform/clock-and-ids` pode ler o relógio ou gerar UUID. O resto usa as portas Clock e IdGenerator.
 */
const noClockOrIdsOutsidePlatform = {
  'no-restricted-syntax': [
    'error',
    {
      selector: "NewExpression[callee.name='Date'][arguments.length=0]",
      message: 'Use a porta Clock (platform/clock-and-ids) em vez de new Date().',
    },
    {
      selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
      message: 'Use a porta Clock (platform/clock-and-ids) em vez de Date.now().',
    },
    {
      selector: "CallExpression[callee.property.name='randomUUID']",
      message: 'Use a porta IdGenerator (platform/clock-and-ids) em vez de randomUUID().',
    },
    {
      selector: "MemberExpression[object.name='DateTime'][property.name='now']",
      message: 'Use a porta Clock (platform/clock-and-ids) em vez de DateTime.now().',
    },
  ],
  'no-restricted-imports': [
    'error',
    { paths: [{ name: 'uuid', message: 'Use a porta IdGenerator (platform/clock-and-ids).' }] },
  ],
};

export default tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'src/generated/**', 'node_modules/**', 'eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: {
        projectService: { allowDefaultProject: ['eslint.config.mjs'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message: 'Leia a configuração tipada (platform/config), nunca process.env direto.',
        },
      ],
      ...noClockOrIdsOutsidePlatform,
    },
  },
  {
    files: ['src/platform/clock-and-ids/**/*.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    // Scripts e configuração de ferramentas ficam fora das regras de Clock e de process.env.
    files: ['prisma/**/*.ts', 'prisma.config.ts', 'test/setup-env.ts'],
    rules: { 'no-restricted-properties': 'off', 'no-restricted-syntax': 'off' },
  },
  {
    files: ['src/platform/config/**/*.ts'],
    rules: { 'no-restricted-properties': 'off' },
  },
  {
    files: ['**/*.spec.ts', 'test/**/*.ts'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
  prettier,
);
