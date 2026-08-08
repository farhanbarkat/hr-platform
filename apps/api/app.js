import express from 'express';
import cors from 'cors';
import companyRouter from './src/routes/company.routes.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: true, limit: '16kb' }));

// Base API Routes
app.use('/api/v1/companies', companyRouter);

export default app;