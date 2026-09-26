import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';
import {
  createSalaryStructure,
  getActiveSalary,
  getSalaryHistory,
} from '../controllers/salaryStructure.controller.js';

const router = Router();

router.use(verifyJWT);

router.route('/').post(requirePermission('payroll.update'), createSalaryStructure);
router.route('/employee/:employeeId/active').get(requirePermission('payroll.read'), getActiveSalary);
router.route('/employee/:employeeId/history').get(requirePermission('payroll.read'), getSalaryHistory);

export default router;