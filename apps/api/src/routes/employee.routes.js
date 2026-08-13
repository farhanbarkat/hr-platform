import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { enforceReadOnlyImpersonation } from '../middlewares/readOnly.middleware.js';
import { ApiResponse } from '../utils/ApiResponse.js';

const router = Router();

// 1. First verify JWT token
router.use(verifyJWT);

// 2. Second enforce Read-Only check for impersonated sessions
router.use(enforceReadOnlyImpersonation);

// GET /api/v1/employees
router.get('/', (req, res) => {
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        employees: [
          { id: '1', name: 'John Doe', role: 'Software Engineer' },
          { id: '2', name: 'Jane Smith', role: 'HR Manager' },
        ],
        isImpersonating: req.user?.isImpersonating || false,
      },
      'Employees retrieved successfully (Read-Only Mode Active).'
    )
  );
});

// POST /api/v1/employees
router.post('/', (req, res) => {
  return res
    .status(201)
    .json(new ApiResponse(201, {}, 'Employee created successfully.'));
});

export default router;