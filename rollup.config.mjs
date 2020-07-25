// @ts-check
import commonjs from '@rollup/plugin-commonjs';
import builtinModules from 'builtin-modules';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { createRequire } from 'module';

// @ts-ignore
const require = createRequire(import.meta.url);

const { getBabelInputPlugin } = require('@rollup/plugin-babel');

const pkg = require('./package.json');

const extensions = ['.js', '.jsx', '.ts', '.tsx'];

/**
 * @type { import('rollup').RollupOptions}
 */
const config = {
  input: 'src/index.ts',
  output: [
    {
      file: pkg.main,
      format: 'esm',
      // TODO: enable sourcemap
      sourcemap: false,
      sourcemapExcludeSources: false,
    },
  ],
  plugins: [
    getBabelInputPlugin({
      extensions,
      babelHelpers: 'bundled',
    }),
    nodeResolve({ extensions, preferBuiltins: true }),
    // @ts-ignore
    commonjs({
      include: /node_modules/,
    }),
  ],
  external: [...Object.keys(pkg.dependencies), ...builtinModules],
};

export default config;
