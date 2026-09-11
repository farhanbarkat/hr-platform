import { Department } from '../models/department.model.js';
import { Employee } from '../models/employee.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * 1. Get All Departments (HR / Admin view)
 */
export const getDepartments = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user?.companyId;
  const { includeInactive } = req.query;

  const query = { companyId };
  if (includeInactive !== 'true') {
    query.isActive = true;
  }

  // Safe Query: strictPopulate: false lagaya hai taake agar schema me field mismatch ho tab bhi server crash na ho
  const departments = await Department.find(query)
    .populate({
      path: 'headOfDepartment', // Schema me exact field 'headOfDepartment' hai
      select: 'firstName lastName email designation',
      strictPopulate: false, // 👈 Crash hone se bachata hai
    })
    .sort({ name: 1 });

  return res
    .status(200)
    .json(
      new ApiResponse(200, departments, 'Departments retrieved successfully.')
    );
});

/**
 * 2. Create Department (Company Admin only)
 */
export const createDepartment = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user?.companyId;

  if (!companyId) {
    throw new ApiError(400, 'Company context is missing from request.');
  }

  const { name, code, headEmployeeId, headOfDepartment } = req.body;

  if (!name || !name.trim()) {
    throw new ApiError(400, 'Department name is required.');
  }

  // Model me code required hai: user ka diya code lein ya name ke first 3 characters use karein
  const deptCode = (code || name.slice(0, 3)).trim().toUpperCase();

  // Check karein ke is company me duplicate name ya code na ho
  const existingDept = await Department.findOne({
    companyId,
    $or: [{ name: name.trim() }, { code: deptCode }],
  });

  if (existingDept) {
    throw new ApiError(
      409,
      `Department with this name ('${name.trim()}') or code ('${deptCode}') already exists in this company.`
    );
  }

  // Head resolution (model me field name 'headOfDepartment' hai)
  const resolvedHeadId = headOfDepartment || headEmployeeId || null;

  const department = await Department.create({
    companyId,
    name: name.trim(),
    code: deptCode, // ✅ Ab code pass ho raha hai
    headOfDepartment:
      resolvedHeadId && resolvedHeadId !== '' ? resolvedHeadId : null, // ✅ Model ke mutabiq field name
    isActive: true,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, department, 'Department created successfully.'));
});
/**
 * 3. Update Department (Company Admin only)
 */
export const updateDepartment = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user?.companyId;
  const { id } = req.params;
  const { name, description, headEmployeeId } = req.body;

  const department = await Department.findOne({ _id: id, companyId });
  if (!department) {
    throw new ApiError(404, 'Department not found.');
  }

  if (name && name.trim() !== department.name) {
    const existing = await Department.findOne({ companyId, name: name.trim() });
    if (existing) {
      throw new ApiError(409, `Department '${name}' already exists.`);
    }
    department.name = name.trim();
  }

  if (description !== undefined) department.description = description;
  if (headEmployeeId !== undefined)
    department.headEmployeeId = headEmployeeId || null;

  await department.save();

  return res
    .status(200)
    .json(new ApiResponse(200, department, 'Department updated successfully.'));
});

/**
 * 4. Deactivate Department (Soft Delete - preserves historical refs)
 */
export const deactivateDepartment = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user?.companyId;
  const { id } = req.params;

  const department = await Department.findOne({ _id: id, companyId });
  if (!department) {
    throw new ApiError(404, 'Department not found.');
  }

  department.isActive = false;
  await department.save();

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        department,
        'Department deactivated successfully. Historical employee links preserved.'
      )
    );
});

/**
 * 5. Reassign Employee to Department (HR & Admin)
 */
export const reassignEmployeeDepartment = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.tenant?._id || req.user?.companyId;

  if (!companyId) {
    throw new ApiError(403, 'Tenant context missing.');
  }

  const { employeeId } = req.params;
  const { departmentId } = req.body;

  // 1. Find employee with tenant context
  const employee = await Employee.findOne({
    _id: employeeId,
    companyId,
  });

  if (!employee) {
    throw new ApiError(404, 'Employee not found in this company.');
  }

  // 2. Validate department if provided
  if (departmentId) {
    const targetDept = await Department.findOne({
      _id: departmentId,
      companyId,
      isActive: true,
    });

    if (!targetDept) {
      throw new ApiError(404, 'Active target department not found.');
    }

    employee.departmentId = targetDept._id;
  } else {
    employee.departmentId = null;
  }

  await employee.save();

  const updatedEmployee = await Employee.findById(employee._id)
    .populate('departmentId', 'name description')
    .populate('userId', 'name email role');

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedEmployee,
        'Employee department reassigned successfully.'
      )
    );
});
