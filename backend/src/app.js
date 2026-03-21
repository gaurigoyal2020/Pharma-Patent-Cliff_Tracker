// src/app.js 
import express from 'express';
import cors from 'cors';
import drugRoutes from './routes/drugs.js';
import authRoutes from './routes/auth.js';
import diseaseRoutes from './routes/diseases.js';

const app = express(); //express() creates an Express application, which is an object that has methods for routing HTTP requests, configuring middleware, and more.

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json()); //parses incoming JSON requests and puts the parsed data in req.body

app.use('/api/drugs', drugRoutes); //Mounts the drugRoutes router on the /api/drugs path. This means that any requests to /api/drugs will be handled by the drugRoutes router.
app.use('/api/auth', authRoutes);
app.use('/api/diseases', diseaseRoutes);

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
