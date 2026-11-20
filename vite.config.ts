import { defineConfig } from 'vite';

// base './' lets the same build run from GitHub Pages sub-paths, any static host, or a local file server.
export default defineConfig({
  base: './',
  build: {
    target: 'es2019',
    chunkSizeWarningLimit: 2000,
    assetsInlineLimit: 0,
  },
  server: { host: true },
});
