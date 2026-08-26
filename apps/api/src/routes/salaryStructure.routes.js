import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { ApiError } from '../utils/ApiError.js';
import {
  createSalaryStructure,
  getActiveSalary,
  getSalaryHistory,
} from '../controllers/salaryStructure.controller.js';

const router = Router();

const allowAdminAndHr = (req, res, next) => {
  const allowed = ['COMPANY_ADMIN', 'HR', 'SUPER_ADMIN'];
  if (!req.user || !allowed.includes(req.user.role)) {
    throw new ApiError(403, 'Forbidden: Only HR and Company Admins can manage salary structures.');
  }
  next();
};

router.use(verifyJWT);
router.use(allowAdminAndHr);

router.route('/').post(createSalaryStructure);
router.route('/employee/:employeeId/active').get(getActiveSalary);
router.route('/employee/:employeeId/history').get(getSalaryHistory);

export default router;