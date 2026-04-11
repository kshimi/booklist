import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, existsSync, mkdirSync, createReadStream, readFileSync, statSync, writeFileSync } from 'fs';
import { resolve, extname, relative, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

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
      for (const file of ['books.json', 'book-metadata.json', 'book-ai-comments.json']) {
        const src = resolve('data', file);
        if (existsSync(src)) copyFileSync(src, resolve(destDir, file));
      }
    },
  };
}

const correctionsPlugin = {
  name: 'corrections-api',
  configureServer(server) {
    server.middlewares.use('/api/corrections', (req, res) => {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end();
        return;
      }
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const { id, author, genre, subgenre, pages } = JSON.parse(body);
          if (!id || typeof id !== 'string') {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: false, error: 'id is required' }));
            return;
          }
          const filePath = resolve(__dirname, 'data/book-corrections.json');
          const data = JSON.parse(readFileSync(filePath, 'utf-8'));
          if (!data.id_corrections) data.id_corrections = {};
          data.id_corrections[id] = { author, genre, subgenre, pages };
          writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true }));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: err.message }));
        }
      });
    });
  },
};

export default defineConfig({
  base: '/booklist/',
  plugins: [react(), serveDataPlugin(), correctionsPlugin],
  publicDir: false,
});
