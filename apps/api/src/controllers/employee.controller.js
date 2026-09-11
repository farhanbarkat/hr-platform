import { Employee } from '../models/employee.model.js';
import { User } from '../models/user.model.js';
import { buildScopedFilter } from '../utils/scopeFilter.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import mongoose from 'mongoose';
import crypto from 'node:crypto';


/**
 * @desc    Create Employee + Auth User Account (HR / Admin only)
 * @route   POST /api/v1/employees
 */
export const createEmployee = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user?.companyId;

  if (!companyId) {
    throw new ApiError(400, 'Company context is missing.');
  }

  const {
    firstName,
    lastName,
    email,
    cnic,
    phone,
    address,
    emergencyContact,
    employeeId,
    department,
    departmentId,
    designation,
    managerId,
    dateOfJoining,
    employmentStatus,
    password,
  } = req.body;

  // ✅ 1. Resolve Department safely (dono me se jo bhi frontend bhej de)
  const resolvedDeptId = department || departmentId;

  // Validation
  if (
    !firstName ||
    !lastName ||
    !email ||
    !cnic ||
    !employeeId ||
    !resolvedDeptId ||
    !designation ||
    !dateOfJoining
  ) {
    throw new ApiError(400, 'All required fields (including Department) must be provided.');
  }

  // Check unique constraints in Employee Collection
  const existingEmployee = await Employee.findOne({
    companyId,
    $or: [{ email: email.toLowerCase() }, { employeeId }, { cnic }],
  });

  if (existingEmployee) {
    throw new ApiError(409, 'An employee with this email, employee ID, or CNIC already exists in your company.');
  }

  // Check unique email in User Collection
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw new ApiError(409, 'A user account with this email already exists.');
  }

  // Validate manager if provided
  if (managerId) {
    const manager = await Employee.findOne({ _id: managerId, companyId });
    if (!manager) {
      throw new ApiError(404, 'Assigned manager does not exist in this company.');
    }
  }

  // Generate safe temporary password
  const tempPassword =
    password || crypto.randomBytes(4).toString('hex') + 'A1!';

  // ✅ 2. Create Auth User Account for Employee
  const newUser = await User.create({
    firstName,
    lastName,
    email: email.toLowerCase(),
    password: tempPassword,
    role: 'EMPLOYEE',
    companyId,
    isEmailVerified: true,
  });

  // ✅ 3. Create Employee Profile Record (with Rollback Protection)
  let newEmployee;
  try {
    newEmployee = await Employee.create({
      companyId,
      userId: newUser._id,
      firstName,
      lastName,
      email: email.toLowerCase(),
      cnic,
      phone: phone || '',
      address: address || '',
      emergencyContact: emergencyContact || '',
      employeeId,
      department: resolvedDeptId,    // 👈 Fixed!
      departmentId: resolvedDeptId,  // 👈 Fixed!
      designation,
      managerId: managerId || null,
      dateOfJoining,
      employmentStatus: employmentStatus || 'PROBATION',
    });
  } catch (err) {
    // Agar employee create hone mein koi masla aaye toh user bhi delete kar do taake data corrupt na ho
    await User.findByIdAndDelete(newUser._id);
    throw err;
  }

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        employee: newEmployee,
        authAccount: {
          userId: newUser._id,
          email: newUser.email,
          role: newUser.role,
          tempPassword,
        },
      },
      'Employee profile and login account created successfully.'
    )
  );
});

/**
 * @desc    Get All Employees (Scoped to Tenant, with Org Manager Info)
 * @route   GET /api/v1/employees
 */
export const getEmployees = asyncHandler(async (req, res) => {
  const scopedFilter = await buildScopedFilter(req);
  const companyId = req.companyId || req.user?.companyId;

  const { department, status, search, page = 1, limit = 20 } = req.query;

  const query = {
    ...scopedFilter,
    companyId,
  };

  // ✅ ROBUST DEPARTMENT FILTER (Handles both ObjectId and String stored in DB)
  if (department && department.trim() !== '' && department !== 'ALL') {
    const trimmedDept = department.trim();
    const isObjectId = mongoose.Types.ObjectId.isValid(trimmedDept);

    const conditions = [{ department: trimmedDept }];
    if (isObjectId) {
      conditions.push({ department: new mongoose.Types.ObjectId(trimmedDept) });
      conditions.push({ departmentId: new mongoose.Types.ObjectId(trimmedDept) });
      conditions.push({ departmentId: trimmedDept });
    }

    // $or se match karega chahay DB mein string ho ya ObjectId
    query.$and = query.$and || [];
    query.$and.push({ $or: conditions });
  }

  // ✅ Status Filter
  if (status && status !== 'ALL' && status.trim() !== '') {
    query.employmentStatus = status.toUpperCase();
  }

  // ✅ Search Filter
  if (search && search.trim() !== '') {
    const s = search.trim();
    query.$or = [
      { firstName: { $regex: s, $options: 'i' } },
      { lastName: { $regex: s, $options: 'i' } },
      { email: { $regex: s, $options: 'i' } },
      { employeeId: { $regex: s, $options: 'i' } },
    ];
  }

  const employees = await Employee.find(query)
    .populate({
      path: 'department',
      select: 'name code',
      strictPopulate: false,
    })
    .populate({
      path: 'managerId',
      select: 'firstName lastName email designation employeeId',
      strictPopulate: false,
    })
    .sort({ createdAt: -1 })
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit));

  const total = await Employee.countDocuments(query);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        employees,
        total,
        page: Number(page),
        limit: Number(limit),
      },
      'Employees retrieved successfully.'
    )
  );
});

/**
 * @desc    Get Single Employee Profile & Direct Reports Hierarchy
 * @route   GET /api/v1/employees/:id
 */
export const getEmployeeById = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user?.companyId;
  const { id } = req.params;

  // 🛡️ Guard: Check valid 24-character ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, `Invalid employee ID format: ${id}`);
  }

  const employee = await Employee.findOne({ _id: id, companyId })
    .populate('managerId', 'firstName lastName email designation employeeId');

  if (!employee) {
    throw new ApiError(404, 'Employee profile not found.');
  }

  // Get direct reports for this employee
  const directReports = await Employee.find({ managerId: id, companyId })
    .select('firstName lastName email designation employeeId employmentStatus');

  return res.status(200).json(
    new ApiResponse(200, { employee, directReports }, 'Employee details and direct reports retrieved.')
  );
});

/**
 * @desc    Update Full Employee Profile (HR / Admin Only)
 * @route   PUT /api/v1/employees/:id
 */
export const updateEmployee = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user?.companyId;
  const { id } = req.params;

  const employee = await Employee.findOne({ _id: id, companyId });
  if (!employee) {
    throw new ApiError(404, 'Employee not found.');
  }

  // Prevent self-management recursion
  if (req.body.managerId && req.body.managerId.toString() === id.toString()) {
    throw new ApiError(400, 'An employee cannot be their own manager.');
  }

  const updatedEmployee = await Employee.findByIdAndUpdate(
    id,
    { $set: req.body },
    { new: true, runValidators: true }
  ).populate('managerId', 'firstName lastName email designation');

  return res.status(200).json(
    new ApiResponse(200, updatedEmployee, 'Employee profile updated successfully.')
  );
});

/**
 * @desc    Self Service: Get Logged-in Employee Profile
 * @route   GET /api/v1/employees/me/profile
 */
export const getMyProfile = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user?.companyId;
  const userId = req.user?._id;

  const employee = await Employee.findOne({
    companyId,
    $or: [{ userId }, { email: req.user?.email }],
  }).populate('managerId', 'firstName lastName email designation');

  if (!employee) {
    throw new ApiError(404, 'Your employee record was not found.');
  }

  return res.status(200).json(
    new ApiResponse(200, employee, 'My profile retrieved successfully.')
  );
});

/**
 * @desc    Self Service: Update Non-Sensitive Info (Phone, Address, Emergency Contact)
 * @route   PATCH /api/v1/employees/me/profile
 */
export const updateMyProfile = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user?.companyId;
  const userId = req.user?._id;

  const { phone, address, emergencyContact } = req.body;

  const allowedUpdates = {};
  if (phone !== undefined) allowedUpdates.phone = phone;
  if (address !== undefined) allowedUpdates.address = address;
  if (emergencyContact !== undefined) allowedUpdates.emergencyContact = emergencyContact;

  const employee = await Employee.findOneAndUpdate(
    { companyId, $or: [{ userId }, { email: req.user?.email }] },
    { $set: allowedUpdates },
    { new: true, runValidators: true }
  );

  if (!employee) {
    throw new ApiError(404, 'Employee record not found.');
  }

  return res.status(200).json(
    new ApiResponse(200, employee, 'Contact details updated successfully.')
  );
});