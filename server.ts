import dotenv from 'dotenv';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPharmaTrackApp } from './server/app';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = createPharmaTrackApp();

app.get('/api/supabase-schema', (_req, res) => {
  const schemaPath = path.resolve(__dirname, 'supabase', 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    res.status(404).json({ error: 'schema.sql not found' });
    return;
  }
  res.type('text/plain').send(fs.readFileSync(schemaPath, 'utf8'));
});

app.use(express.static(path.resolve(__dirname, 'dist')));

export default app;
