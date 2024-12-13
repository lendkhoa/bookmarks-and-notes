// esbuild.js
const esbuild = require('esbuild-wasm');

async function build() {
  try {
    console.log('Starting build...');
    await esbuild.initialize({});

    // Build the extension
    await esbuild.build({
      entryPoints: ['./src/extension.ts'],
      bundle: true,
      outfile: 'dist/extension.js',
      external: ['vscode'],
      format: 'cjs',
      platform: 'node',
      sourcemap: true,
      minify: process.argv.includes('--production'),
    });

    // Build the webview
    await esbuild.build({
      entryPoints: ['./src/webview/index.tsx'],
      bundle: true,
      outfile: 'dist/canvas.js',
      external: ['vscode'],
      format: 'iife',
      platform: 'browser',
      target: 'es2020',
      sourcemap: true,
      minify: process.argv.includes('--production'),
      loader: {
        '.tsx': 'tsx',
        '.ts': 'ts',
        '.js': 'jsx',
        '.css': 'css',
      },
      define: {
        'process.env.NODE_ENV': '"production"'
      }
    });

    console.log('Build complete');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();