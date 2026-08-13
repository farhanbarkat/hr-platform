import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Company } from '../models/company.model.js';
import { User } from '../models/user.model.js';
import { AccessLog } from '../models/accessLog.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { generateAccessToken } from '../utils/token.util.js';

/**
 * @desc    Onboard a new company with initial Company Admin
 * @route   POST /api/v1/super-admin/companies
 */
export const createCompany = asyncHandler(async (req, res) => {
  const {
    name,
    slug,
    currency = 'USD',
    timezone = 'UTC',
    adminEmail,
    adminFirstName,
    adminLastName,
  } = req.body;

  if (!name || !slug || !adminEmail || !adminFirstName || !adminLastName) {
    throw new ApiError(400, 'Company details and admin contact info are required.');
  }

  const existingSlug = await Company.findOne({ slug: slug.toLowerCase() });
  if (existingSlug) {
    throw new ApiError(400, 'A company with this slug already exists.');
  }

  const existingUser = await User.findOne({ email: adminEmail.toLowerCase() });
  if (existingUser) {
    throw new ApiError(400, 'An account with this admin email already exists.');
  }

  // Create Company
  const company = await Company.create({
    name,
    slug: slug.toLowerCase(),
    currency,
    timezone,
    isActive: true,
  });

  // Generate temporary password for admin
  const tempPassword = crypto.randomBytes(6).toString('hex') + 'A1!';

  // Create Initial Company Admin
  const adminUser = await User.create({
    firstName: adminFirstName,
    lastName: adminLastName,
    email: adminEmail.toLowerCase(),
    password: tempPassword,
    role: 'COMPANY_ADMIN',
    companyId: company._id,
    isEmailVerified: true,
  });

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        company,
        adminUser: {
          _id: adminUser._id,
          email: adminUser.email,
          role: adminUser.role,
          tempPassword, // Return for initial onboard dispatch
        },
      },
      'Company and Company Admin created successfully.'
    )
  );
});

/**
 * @desc    List all companies with employee counts
 * @route   GET /api/v1/super-admin/companies
 */
export const listCompanies = asyncHandler(async (req, res) => {
  const companies = await Company.aggregate([
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: 'companyId',
        as: 'employees',
      },
    },
    {
      $project: {
        name: 1,
        slug: 1,
        currency: 1,
        timezone: 1,
        isActive: 1,
        createdAt: 1,
        employeeCount: { $size: '$employees' },
      },
    },
    { $sort: { createdAt: -1 } },
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, { companies }, 'Companies retrieved successfully.'));
});

/**
 * @desc    Deactivate or Toggle Company Status
 * @route   PATCH /api/v1/super-admin/companies/:id/status
 */
export const toggleCompanyStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  if (typeof isActive !== 'boolean') {
    throw new ApiError(400, 'isActive boolean flag is required.');
  }

  const company = await Company.findByIdAndUpdate(
    id,
    { isActive },
    { new: true }
  );

  if (!company) {
    throw new ApiError(404, 'Company not found.');
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { company },
        `Company successfully ${isActive ? 'activated' : 'deactivated'}.`
      )
    );
});

/**
 * @desc    Support Impersonation - View Company Data Read-Only
 * @route   POST /api/v1/super-admin/companies/:id/impersonate
 */
/**
 * @desc    Support Impersonation - View Company Data Read-Only
 * @route   POST /api/v1/super-admin/companies/:id/impersonate
 */
export const impersonateCompany = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const reason = req.body?.reason || req.query?.reason;

  if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
    throw new ApiError(
      400,
      'A mandatory free-text reason (at least 10 characters) is required for impersonation.'
    );
  }

  const targetCompany = await Company.findById(id);
  if (!targetCompany) {
    throw new ApiError(404, 'Target company not found.');
  }

  // 1. Audit Log Entry
  await AccessLog.logAttempt({
    companyId: targetCompany._id,
    userId: req.user._id,
    permission: 'superadmin.impersonate',
    allowed: true,
    resourceType: 'other',
    resourceId: targetCompany._id,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    metadata: {
      action: 'IMPERSONATE_COMPANY',
      reason: reason.trim(),
      superAdminEmail: req.user.email,
      targetCompanyName: targetCompany.name,
    },
  });

  // 2. Generate Read-Only Impersonation Token
  const impersonationToken = jwt.sign(
    {
      _id: req.user._id,
      email: req.user.email,
      role: 'SUPER_ADMIN',
      companyId: targetCompany._id,
      isImpersonating: true,
      isReadOnly: true,
      impersonatedCompanyId: targetCompany._id,
      impersonatedCompanyName: targetCompany.name,
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '2h' }
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        impersonationToken,
        targetCompany: {
          id: targetCompany._id,
          name: targetCompany.name,
          slug: targetCompany.slug,
        },
      },
      `Impersonation session granted for ${targetCompany.name}.`
    )
  );
});