import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import caseRoutes from './routes/caseRoutes.js';
import sightingRoutes from './routes/sightingRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import { errorHandler, notFound } from './middleware/error.js';

dotenv.config();
const app = express();

app.use(helmet());

// Use FRONTEND_URL for production and allow optional dev origins via CORS_DEV_ORIGINS
const productionOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',').map(o => o.trim());
const devOrigins = [];
if (process.env.NODE_ENV !== 'production') {
  const devList = process.env.CORS_DEV_ORIGINS || 'http://localhost:5174,http://localhost:5175,http://localhost:5176,http://localhost:5177';
  devOrigins.push(...devList.split(',').map(o => o.trim()));
}
const allowedOrigins = [...productionOrigins, ...devOrigins];

app.use(cors({
  origin: (origin, cb) => (!origin || allowedOrigins.includes(origin) ? cb(null, true) : cb(new Error('CORS: ' + origin))),
  credentials: true
}));

app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));

app.get('/', (req, res) => res.json({ message: 'Missing Diary API', endpoints: '/api/auth, /api/cases, /api/sightings, /api/admin, /api/notifications, /health' }));
app.get('/health', (req, res) => res.json({ ok: true, app: 'Missing Diary API' }));
app.use('/api/auth', authRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/sightings', sightingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);

app.use(notFound);
app.use(errorHandler);

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`API running on http://localhost:${port}`));
