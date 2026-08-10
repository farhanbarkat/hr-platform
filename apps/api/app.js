import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import companyRouter from './src/routes/company.routes.js';
import authRouter from './src/routes/auth.routes.js';

const app = express();

app.use(cors());
app.use(cookieParser());
app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: true, limit: '16kb' }));

// Base API Routes
app.use('/api/v1/companies', companyRouter);
app.use('/api/v1/auth', authRouter);
export default app;