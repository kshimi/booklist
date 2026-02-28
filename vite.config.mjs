import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, mkdirSync, createReadStream, statSync } from 'fs';
import { resolve, extname } from 'path';

const MIME_TYPES = {
  '.json': 'application/json',
  '.pdf': 'application/pdf',
};

/**
 * Plugin: serve data/ as static files in dev mode and copy to dist/data/ on build.
 * Replaces publicDir:'.' which broke the production build (copied .git to dist/).
 */
function serveDataPlugin() {
  return {
    name: 'serve-data',
    configureServer(server) {
      server.middlewares.use('/data', (req, res, next) => {
        const filePath = resolve('data', req.url.replace(/^\/+/, ''));
        try {
          statSync(filePath);
          const mime = MIME_TYPES[extname(filePath)] ?? 'application/octet-stream';
          res.setHeader('Content-Type', mime);
          createReadStream(filePath).pipe(res);
        } catch {
          next();
        }
      });
    },
    closeBundle() {
      const destDir = resolve('dist/data');
      mkdirSync(destDir, { recursive: true });
      copyFileSync(resolve('data/books.json'), resolve(destDir, 'books.json'));
    },
  };
}

export default defineConfig({
  plugins: [react(), serveDataPlugin()],
  publicDir: false,
});
