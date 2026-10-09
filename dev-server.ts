import dotenv from 'dotenv';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPharmaTrackApp } from './server/app';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = createPharmaTrackApp();
const PORT = Number(process.env.PORT) || 3000;

app.get('/api/supabase-schema', (_req, res) => {
  const schemaPath = path.resolve(__dirname, 'supabase', 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    res.status(404).json({ error: 'schema.sql not found' });
    return;
  }
  res.type('text/plain').send(fs.readFileSync(schemaPath, 'utf8'));
});

async function setupApp() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.resolve(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[PharmaTrack] Server listening on http://0.0.0.0:${PORT}`);
  });
}

setupApp().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
