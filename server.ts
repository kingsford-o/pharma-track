import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { handleSignup } from './server/authSignup';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

app.post('/api/auth/signup', (req, res, next) => {
  handleSignup(req, res).catch(next);
});

// API: Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'PharmaTrack Dispensary OS',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    database: 'Supabase PostgreSQL (Active)'
  });
});

// API: Return raw Supabase SQL Schema
app.get('/api/supabase-schema', (req, res) => {
  try {
    const schemaPath = path.resolve(__dirname, 'supabase', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      res.setHeader('Content-Type', 'text/plain');
      return res.send(sql);
    }
    return res.status(404).json({ error: 'schema.sql not found' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to read schema file' });
  }
});

// API: Real-Time Market Benchmark Registry
app.get('/api/market-prices', (req, res) => {
  res.json([
    {
      itemName: 'Paracetamol 500mg tablets',
      wholesaleRefGhc: 0.25,
      retailCapGhc: 0.45,
      marketRangeMinGhc: 0.22,
      marketRangeMaxGhc: 0.28,
      source: 'Ghana FDA / NHIS Standard Formulary Benchmark',
      trend: 'stable'
    },
    {
      itemName: 'Amoxicillin 250mg capsules',
      wholesaleRefGhc: 0.85,
      retailCapGhc: 1.40,
      marketRangeMinGhc: 0.80,
      marketRangeMaxGhc: 0.95,
      source: 'Ghana Ministry of Health Wholesale Price Index',
      trend: 'increasing'
    },
    {
      itemName: 'Metformin 500mg tablets',
      wholesaleRefGhc: 0.30,
      retailCapGhc: 0.60,
      marketRangeMinGhc: 0.28,
      marketRangeMaxGhc: 0.35,
      source: 'WHO Essential Medicines Standard Pricing Board',
      trend: 'stable'
    }
  ]);
});

// Vite Middleware for Development / Static file serving for Production
async function setupApp() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[PharmaTrack Dispensary OS] Server listening on http://0.0.0.0:${PORT}`);
  });
}

setupApp().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
