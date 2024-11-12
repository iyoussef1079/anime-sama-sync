// backend/src/server.ts
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { syncRouter } from './routes/sync';
import { authMiddleware } from './middleware/auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: [
    'chrome-extension://gdfdaipeimopefbignmelngegaaphojk',
    'http://localhost:3000'
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());
app.use(authMiddleware);
app.use('/api', syncRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;