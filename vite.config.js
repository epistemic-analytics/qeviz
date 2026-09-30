import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // ENALayer dispatches to element constructors by looking up obj.constructor.name
  // in a string-keyed map. esbuild minifies class names by default (e.g. Point → "f"),
  // which breaks that lookup. keepNames preserves .name on all functions/classes.
  esbuild: {
    keepNames: true,
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'QEViz',
      fileName: (format) => `qeviz.${format}.js`,
      formats: ['es', 'umd'],
    },
    outDir: 'dist',
    // esbuild minification; keepNames (above) keeps class / function names.
    minify: 'esbuild',
    sourcemap: true,
    rollupOptions: {
      // qeviz is fully self-contained — no external runtime dependencies
    },
  },
});
