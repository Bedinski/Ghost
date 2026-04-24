import { defineConfig } from 'vite';

// GitHub Pages serves under /<repo-name>/ for project pages.
// Override via VITE_BASE env if deploying under a different path.
const base = process.env.VITE_BASE ?? '/Ghost/';

export default defineConfig({
  base,
  build: {
    target: 'es2022',
    assetsInlineLimit: 8192,
    cssCodeSplit: false,
    sourcemap: false,
  },
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
  assetsInclude: ['**/*.vert', '**/*.frag'],
});
