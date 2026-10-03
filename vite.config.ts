import { defineConfig } from 'vite';
import { asepritePlugin } from './tools/asepritePlugin';

export default defineConfig({
  base: './',
  plugins: [asepritePlugin()],
  server: { port: 5173, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true },
});
