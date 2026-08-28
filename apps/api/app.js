import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import { enforceReadOnlyImpersonation } from './src/middlewares/readOnly.middleware.js';
import { errorHandler } from './src/middlewares/error.middleware.js';

// Routers Import
import authRouter from './src/routes/auth.routes.js';
import superAdminRouter from './src/routes/superAdmin.routes.js';
import superAdminAdvancedRouter from './src/routes/superAdminAdvanced.routes.js';
import departmentRouter from './src/routes/department.routes.js';
import roleOverrideRouter from './src/routes/roleCapabilityOverride.routes.js';
import companyRouter from './src/routes/company.routes.js';
import employeeRouter from './src/routes/employee.routes.js';
import documentRouter from './src/routes/document.routes.js';
import attendanceRouter from './src/routes/attendance.routes.js';
import leaveRoutes from './src/routes/leave.routes.js';
import salaryStructureRouter from './src/routes/salaryStructure.routes.js';
import salaryTypeRouter from './src/routes/salaryType.routes.js';
import payrollRoutes from './src/routes/payroll.routes.js';
import payslipRouter from './src/routes/payslip.routes.js';
import calendarRoutes from './src/routes/calendar.routes.js';
import taskRoutes from './src/routes/task.routes.js';
import essRouter from './src/routes/ess.routes.js';
import expenseClaimRouter from './src/routes/expenseClaim.routes.js';
import customRoleRouter from './src/routes/customRole.routes.js';
import announcementRouter from './src/routes/announcement.routes.js';
import notificationRouter from './src/routes/notification.routes.js';
import letterTemplateRouter from './src/routes/letterTemplate.routes.js';
import promotionRouter from './src/routes/promotion.routes.js';
import offboardingRouter from './src/routes/offboarding.routes.js';
import shiftRouter from './src/routes/shift.routes.js';
import shiftInchargeRouter from './src/routes/shiftIncharge.routes.js';
import shiftSwapRouter from './src/routes/shiftSwap.routes.js';


const app = express();

// Global Middlewares
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: true, limit: '16kb' }));
app.use(express.static('public'));
app.use(cookieParser());

// Auth & Super Admin routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/super-admin', superAdminRouter);
app.use('/api/v1/super-admin/advanced', superAdminAdvancedRouter);

// Organization & Department routes
app.use('/api/v1/companies', companyRouter);
app.use('/api/v1/departments', departmentRouter);
app.use('/api/v1/calendar', calendarRoutes);
app.use('/api/v1/roles/overrides', roleOverrideRouter);
app.use('/api/v1/roles/custom', customRoleRouter);

// Protected tenant/company routes (with read-only guard applied)
app.use('/api/v1/employees', enforceReadOnlyImpersonation, employeeRouter);
app.use('/api/v1/documents', documentRouter);
app.use('/api/v1/attendance', attendanceRouter);
app.use('/api/v1/tasks', taskRoutes);

// Leaves & Salary types routes
app.use('/api/v1/leaves', leaveRoutes);
app.use('/api/v1/salaries', salaryStructureRouter);
app.use('/api/v1/salary-types', salaryTypeRouter);

// Payroll & Payslips routes
app.use('/api/v1/payroll', payrollRoutes);
app.use('/api/v1/payslips', payslipRouter);

// ESS Portal routes
app.use('/api/v1/ess', essRouter);

// Expense Claims Route
app.use('/api/v1/expenses', expenseClaimRouter);

// Announcements & Notifications routes
app.use('/api/v1/announcements', announcementRouter);
app.use('/api/v1/notifications', notificationRouter);

// Letter Templates Route (TICKET-022B1)
app.use('/api/v1/letter-templates', letterTemplateRouter);

// Career & Promotions route (TICKET-022B)
app.use('/api/v1/promotions', promotionRouter);

// Offboarding, Resignations & Exit Lifecycle (TICKET-022C)
app.use('/api/v1/offboarding', offboardingRouter);

// Shift Management & Scheduling (TICKET-023)
app.use('/api/v1/shifts', shiftRouter);

// Shift Incharge Real-Time Dashboard Route (TICKET-024)
app.use('/api/v1/shift-incharge', shiftInchargeRouter);

// Shift Swap Requests (TICKET-025)
app.use('/api/v1/shift-swaps', shiftSwapRouter);

// Global Error Handler
app.use(errorHandler); 


export default app;