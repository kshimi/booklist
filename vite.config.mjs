import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, mkdirSync, createReadStream, statSync } from 'fs';
import { resolve, extname, relative } from 'path';

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
      const dataRoot = resolve('data');
      server.middlewares.use('/data', (req, res, next) => {
        const filePath = resolve(dataRoot, req.url.replace(/^\/+/, ''));
        // Reject path traversal (e.g. /data/../../package.json)
        if (relative(dataRoot, filePath).startsWith('..')) { next(); return; }
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
