import companyRouter from './src/routes/company.routes.js';
import payslipRouter from './src/routes/payslip.routes.js';
// (Agar app.js already src ke andar hai to path: './routes/payslip.routes.js')
import salaryStructureRouter from './src/routes/salaryStructure.routes.js';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { enforceReadOnlyImpersonation } from './src/middlewares/readOnly.middleware.js';
import { errorHandler } from './src/middlewares/error.middleware.js';


const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: true, limit: '16kb' }));
app.use(express.static('public'));
app.use(cookieParser());

// Routers Import
import authRouter from './src/routes/auth.routes.js';
import superAdminRouter from './src/routes/superAdmin.routes.js';
import employeeRouter from './src/routes/employee.routes.js';
import documentRouter from './src/routes/document.routes.js';
import attendanceRouter from './src/routes/attendance.routes.js';
import leaveRoutes from './src/routes/leave.routes.js';
import payrollRoutes from './src/routes/payroll.routes.js';
import calendarRoutes from './src/routes/calendar.routes.js';
import taskRoutes from './src/routes/task.routes.js';

// Apply Read-Only Enforcer Globally after Auth parsing
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/super-admin', superAdminRouter);
app.use('/api/v1/super-admin/advanced', superAdminAdvancedRouter);

app.use('/api/v1/departments', departmentRouter);

// Protected tenant/company routes (with read-only guard applied)
app.use('/api/v1/employees', enforceReadOnlyImpersonation, employeeRouter);
// Route registration
app.use('/api/v1/documents', documentRouter);

app.use('/api/v1/attendance', attendanceRouter);

// Route declaration
app.use('/api/v1/leaves', leaveRoutes);

// Register under v1
app.use('/api/v1/salaries', salaryStructureRouter);

app.use('/api/v1/payroll', payrollRoutes);

app.use('/api/v1/payslips', payslipRouter);

app.use('/api/v1/companies', companyRouter);

app.use('/api/v1/calendar', calendarRoutes);

app.use('/api/v1/tasks', taskRoutes);

app.use(errorHandler);
export default app;