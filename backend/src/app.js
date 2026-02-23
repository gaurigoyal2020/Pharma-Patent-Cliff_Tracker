// src/app.js  (updated — add the two new import lines and the auth route)
import express from 'express';
import cors from 'cors';
import drugRoutes from './routes/drugs.js';
import authRoutes from './routes/auth.js';   // ← NEW

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

app.use('/api/drugs', drugRoutes);
app.use('/api/auth', authRoutes);             // ← NEW

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.path} not found` });
});

app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

export default app;
