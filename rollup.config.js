import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import typescript from '@rollup/plugin-typescript';
import { terser } from 'rollup-plugin-terser';
import pkg from './package.json';

export default [
  // UMD版本 (用于浏览器直接引入)
  {
    input: 'src/index.ts',
    output: {
      name: 'EdgeSentinelSDK',
      file: pkg.unpkg,
      format: 'umd',
      exports: 'default'
    },
    plugins: [
      resolve(),
      commonjs(),
      typescript({ tsconfig: './tsconfig.json' }),
      babel({
        babelHelpers: 'bundled',
        presets: [['@babel/preset-env', { targets: '> 0.25%, not dead' }]],
        extensions: ['.js', '.ts']
      }),
      terser()
    ]
  },
  // ESM版本 (用于现代打包工具)
  {
    input: 'src/index.ts',
    output: [
      { file: pkg.main, format: 'cjs', exports: 'default' },
      { file: pkg.module, format: 'es' }
    ],
    plugins: [
      resolve(),
      typescript({ tsconfig: './tsconfig.json' }),
      babel({
        babelHelpers: 'bundled',
        presets: [['@babel/preset-env', { targets: { node: '12' } }]],
        extensions: ['.js', '.ts']
      })
    ]
  }
];
