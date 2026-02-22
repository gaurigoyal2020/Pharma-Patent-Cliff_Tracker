// src/app.js
import express from 'express';
import cors from 'cors';
import { runMigrations } from './config/migrate.js';
import authRoutes from './routes/auth.js';
import drugRoutes from './routes/drugs.js';

const app = express();

// Create tables on startup if they don't exist yet
runMigrations();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/drugs', drugRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Patent Cliff backend running ✅' });
});

export default app;