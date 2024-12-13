// esbuild.js
const esbuild = require('esbuild-wasm');
const path = require('path');

async function build() {
  try {
    console.log('Starting build...');
    
    await esbuild.initialize({});
    
    const result = await esbuild.build({
      entryPoints: ['./src/extension.ts'],
      bundle: true,
      outfile: 'dist/extension.js',
      external: ['vscode'],
      format: 'cjs',
      platform: 'node',
      sourcemap: true,
      logLevel: 'info'
    });

    console.log('Build completed:', result);
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();