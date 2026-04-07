// src/app.js  (replaces existing app.js — adds userRoutes)
import express from 'express';
import cors    from 'cors';
import drugRoutes    from './routes/drugs.js';
import authRoutes    from './routes/auth.js';
import diseaseRoutes from './routes/diseases.js';
import userRoutes    from './routes/users.js';
import ocrRoutes     from './routes/ocr.js';

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

app.use('/api/drugs',    drugRoutes);
app.use('/api/auth',     authRoutes);
app.use('/api/diseases', diseaseRoutes);
app.use('/api/users',    userRoutes);
app.use('/api/ocr',      ocrRoutes);

app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
);

app.use((req, res) =>
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.path} not found` })
);

app.use((err, _req, res, _next) => {
  console.error('[Error]', err.message);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

export default app;