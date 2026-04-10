import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
          const filePath = path.resolve(__dirname, 'data/book-corrections.json');
          const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          if (!data.id_corrections) data.id_corrections = {};
          data.id_corrections[id] = { author, genre, subgenre, pages };
          fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
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
  plugins: [react(), correctionsPlugin],
});
