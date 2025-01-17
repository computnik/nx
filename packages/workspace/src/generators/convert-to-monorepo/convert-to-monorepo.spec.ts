import { readJson, readProjectConfiguration, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { monorepoGenerator } from './convert-to-monorepo';

// nx-ignore-next-line
const { libraryGenerator } = require('@nx/js');
// nx-ignore-next-line
const { applicationGenerator: reactAppGenerator } = require('@nx/react');
// nx-ignore-next-line
const { applicationGenerator: nextAppGenerator } = require('@nx/next');

describe('monorepo generator', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should convert root JS lib', async () => {
    // Files that should not move
    tree.write('.gitignore', '');
    tree.write('README.md', '');
    tree.write('tools/scripts/custom_script.sh', '');

    await libraryGenerator(tree, { name: 'my-lib', rootProject: true });
    await libraryGenerator(tree, { name: 'other-lib' });

    await monorepoGenerator(tree, {
      appsDir: 'apps',
      libsDir: 'packages',
    });

    expect(readJson(tree, 'packages/my-lib/project.json')).toMatchObject({
      sourceRoot: 'packages/my-lib/src',
      targets: {
        build: {
          executor: '@nx/js:tsc',
          options: {
            main: 'packages/my-lib/src/index.ts',
            tsConfig: 'packages/my-lib/tsconfig.lib.json',
          },
        },
      },
    });
    expect(readJson(tree, 'packages/other-lib/project.json')).toMatchObject({
      sourceRoot: 'packages/other-lib/src',
    });

    // Did not move files that don't belong to root project
    expect(tree.exists('.gitignore')).toBeTruthy();
    expect(tree.exists('README.md')).toBeTruthy();
    expect(tree.exists('tools/scripts/custom_script.sh')).toBeTruthy();

    // Extracted base config files
    expect(tree.exists('tsconfig.base.json')).toBeTruthy();
  });

  it('should convert root React app (Vite, Vitest)', async () => {
    await reactAppGenerator(tree, {
      name: 'demo',
      style: 'css',
      bundler: 'vite',
      unitTestRunner: 'vitest',
      e2eTestRunner: 'none',
      linter: 'eslint',
      rootProject: true,
    });

    await monorepoGenerator(tree, {});

    expect(readJson(tree, 'apps/demo/project.json')).toMatchObject({
      sourceRoot: 'apps/demo/src',
    });

    // Extracted base config files
    expect(tree.exists('tsconfig.base.json')).toBeTruthy();
    expect(tree.exists('.eslintrc.base.json')).toBeTruthy();
  });

  it('should respect nested libraries', async () => {
    await reactAppGenerator(tree, {
      name: 'demo',
      style: 'css',
      bundler: 'vite',
      unitTestRunner: 'vitest',
      e2eTestRunner: 'none',
      linter: 'eslint',
      rootProject: true,
    });

    await libraryGenerator(tree, {
      name: 'my-lib',
      directory: 'inner',
      style: 'css',
      bundler: 'vite',
      unitTestRunner: 'none',
      e2eTestRunner: 'none',
      linter: 'eslint',
      rootProject: true,
    });

    await monorepoGenerator(tree, {});

    expect(tree.exists('libs/inner/my-lib/tsconfig.json')).toBeTruthy();
    expect(tree.exists('libs/inner/my-lib/src/index.ts')).toBeTruthy();
  });

  it('should convert root React app (Webpack, Jest)', async () => {
    await reactAppGenerator(tree, {
      name: 'demo',
      style: 'css',
      bundler: 'webpack',
      unitTestRunner: 'jest',
      e2eTestRunner: 'none',
      linter: 'eslint',
      rootProject: true,
    });

    await monorepoGenerator(tree, {});

    expect(readJson(tree, 'apps/demo/project.json')).toMatchObject({
      sourceRoot: 'apps/demo/src',
      targets: {
        build: {
          executor: '@nx/webpack:webpack',
          options: {
            main: 'apps/demo/src/main.tsx',
            tsConfig: 'apps/demo/tsconfig.app.json',
            webpackConfig: 'apps/demo/webpack.config.js',
          },
        },
        test: {
          executor: '@nx/jest:jest',
          options: {
            jestConfig: 'apps/demo/jest.config.app.ts',
          },
        },
      },
    });

    // Extracted base config files
    expect(tree.exists('tsconfig.base.json')).toBeTruthy();
    expect(tree.exists('.eslintrc.base.json')).toBeTruthy();
    expect(tree.exists('jest.config.ts')).toBeTruthy();
  });

  it('should convert root Next.js app with existing libraries', async () => {
    await nextAppGenerator(tree, {
      name: 'demo',
      style: 'css',
      unitTestRunner: 'jest',
      e2eTestRunner: 'none',
      appDir: true,
      linter: 'eslint',
      rootProject: true,
    });
    await libraryGenerator(tree, { name: 'util' });

    await monorepoGenerator(tree, {});

    expect(readJson(tree, 'apps/demo/project.json')).toMatchObject({
      sourceRoot: 'apps/demo',
    });
    expect(tree.read('apps/demo/app/page.tsx', 'utf-8')).toContain('demo');
    expect(readJson(tree, 'libs/util/project.json')).toMatchObject({
      sourceRoot: 'libs/util/src',
    });
    expect(tree.read('libs/util/src/lib/util.ts', 'utf-8')).toContain('util');

    // Extracted base config files
    expect(tree.exists('tsconfig.base.json')).toBeTruthy();
    expect(tree.exists('.eslintrc.base.json')).toBeTruthy();
    expect(tree.exists('jest.config.ts')).toBeTruthy();
  });
});
