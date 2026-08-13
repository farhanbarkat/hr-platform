import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { enforceReadOnlyImpersonation } from './src/middlewares/readOnly.middleware.js';

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: true, limit: '16kb' }));
app.use(express.static('public'));
app.use(cookieParser());

// Routers Import
import authRouter from './src/routes/auth.routes.js';
import superAdminRouter from './src/routes/superAdmin.routes.js';
import employeeRouter from './src/routes/employee.routes.js'; // Demo route for Step 4

// Apply Read-Only Enforcer Globally after Auth parsing
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/super-admin', superAdminRouter);

// Protected tenant/company routes (with read-only guard applied)
app.use('/api/v1/employees', enforceReadOnlyImpersonation, employeeRouter);

export default app;