import { Task } from '../models/task.model.js';
import { Employee } from '../models/employee.model.js';
import { Department } from '../models/department.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * 1. Get Tasks (Scoped by team or assignee)
 */
export const getTasks = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user?.companyId;
  const user = req.user;
  const { teamId, status } = req.query;

  const userRole = typeof user.role === 'object' ? user.role.name || user.role.code : user.role;
  const query = { companyId };

  if (status) {
    query.status = status.toUpperCase();
  }

  // Admin/HR can filter by any team or view all
  if (userRole === 'COMPANY_ADMIN' || userRole === 'HR' || userRole === 'SUPER_ADMIN') {
    if (teamId) query.teamId = teamId;
  } else {
    // Standard employee/manager: Resolve their department
    const employee = await Employee.findOne({
      companyId,
      $or: [{ userId: user._id || user.id }, { _id: user.employeeId }],
    });

    if (!employee) {
      throw new ApiError(404, 'Employee profile not found for this user.');
    }

    const userTeamId = employee.departmentId || employee.teamId;

    if (userRole === 'MANAGER' || userRole === 'SHIFT_INCHARGE') {
      // Manager views tasks in their team
      query.teamId = userTeamId;
    } else {
      // Employee views tasks assigned to them or their team board
      if (teamId) {
        if (teamId.toString() !== userTeamId?.toString()) {
          throw new ApiError(403, 'You cannot access another team\'s task board.');
        }
        query.teamId = teamId;
      } else {
        query.$or = [{ assignedTo: employee._id }, { teamId: userTeamId }];
      }
    }
  }

  const tasks = await Task.find(query)
    .populate({
      path: 'assignedTo',
      select: 'firstName lastName email',
      populate: { path: 'userId', select: 'name email' },
    })
    .populate('assignedBy', 'name email')
    .populate('teamId', 'name code')
    .sort({ deadline: 1 });

  return res.status(200).json(new ApiResponse(200, tasks, 'Tasks retrieved successfully.'));
});

/**
 * 2. Create and Assign Task (Manager Guarded)
 */
export const createTask = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user?.companyId;
  const user = req.user;
  const { title, description, assignedTo, teamId, priority, deadline } = req.body;

  if (!title || !assignedTo || !teamId || !deadline) {
    throw new ApiError(400, 'Title, assignedTo employee, teamId, and deadline are required.');
  }

  const userRole = typeof user.role === 'object' ? user.role.name || user.role.code : user.role;

  // Manager Scope Validation: Ensure Manager only assigns within their own team
  if (userRole === 'MANAGER' || userRole === 'SHIFT_INCHARGE') {
    const managerEmployee = await Employee.findOne({
      companyId,
      $or: [{ userId: user._id || user.id }, { _id: user.employeeId }],
    });

    const managerTeamId = managerEmployee?.departmentId || managerEmployee?.teamId;
    if (!managerTeamId || managerTeamId.toString() !== teamId.toString()) {
      throw new ApiError(403, 'Managers can only create and assign tasks within their own team.');
    }
  } else if (userRole !== 'COMPANY_ADMIN' && userRole !== 'HR' && userRole !== 'SUPER_ADMIN') {
    throw new ApiError(403, 'Only Managers, HR, or Company Admins can assign tasks.');
  }

  // Validate that the assigned employee actually belongs to the specified team
  const targetEmployee = await Employee.findOne({
    _id: assignedTo,
    companyId,
  });

  if (!targetEmployee) {
    throw new ApiError(404, 'Assigned employee does not exist in this company.');
  }

  const employeeTeamId = targetEmployee.departmentId || targetEmployee.teamId;
  if (employeeTeamId && employeeTeamId.toString() !== teamId.toString()) {
    throw new ApiError(400, 'Assigned employee does not belong to the selected team.');
  }

  const task = await Task.create({
    companyId,
    title,
    description: description || '',
    assignedTo,
    assignedBy: user._id || user.id,
    teamId,
    priority: priority ? priority.toUpperCase() : 'MEDIUM',
    deadline: new Date(deadline),
    status: 'TODO',
  });

  const populatedTask = await Task.findById(task._id)
    .populate({
      path: 'assignedTo',
      select: 'firstName lastName email',
      populate: { path: 'userId', select: 'name email' },
    })
    .populate('assignedBy', 'name email')
    .populate('teamId', 'name code');

  // Emit real-time Socket.io event to the team room
  const io = req.app.get('io');
  if (io) {
    io.to(`team:${teamId}`).emit('task:created', populatedTask);
  }

  return res.status(201).json(new ApiResponse(201, populatedTask, 'Task created and assigned successfully.'));
});

/**
 * 3. Update Task Status (Employee Drag-and-Drop Handler)
 */
export const updateTaskStatus = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user?.companyId;
  const user = req.user;
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !['TODO', 'IN_PROGRESS', 'COMPLETED'].includes(status.toUpperCase())) {
    throw new ApiError(400, 'Valid status (TODO, IN_PROGRESS, COMPLETED) is required.');
  }

  const task = await Task.findOne({ _id: id, companyId });
  if (!task) {
    throw new ApiError(404, 'Task not found.');
  }

  const userRole = typeof user.role === 'object' ? user.role.name || user.role.code : user.role;

  // Non-admin / employee check: can only update status if assigned to them
  if (userRole !== 'COMPANY_ADMIN' && userRole !== 'HR' && userRole !== 'SUPER_ADMIN') {
    const employee = await Employee.findOne({
      companyId,
      $or: [{ userId: user._id || user.id }, { _id: user.employeeId }],
    });

    const isAssigned = task.assignedTo.toString() === employee?._id.toString();
    const isManagerOfTeam =
      (userRole === 'MANAGER' || userRole === 'SHIFT_INCHARGE') &&
      task.teamId.toString() === (employee?.departmentId || employee?.teamId)?.toString();

    if (!isAssigned && !isManagerOfTeam) {
      throw new ApiError(403, 'You can only update the status of tasks assigned to you.');
    }
  }

  task.status = status.toUpperCase();
  await task.save();

  const updatedTask = await Task.findById(task._id)
    .populate({
      path: 'assignedTo',
      select: 'firstName lastName email',
      populate: { path: 'userId', select: 'name email' },
    })
    .populate('assignedBy', 'name email')
    .populate('teamId', 'name code');

  // Real-time broadcast
  const io = req.app.get('io');
  if (io) {
    io.to(`team:${task.teamId}`).emit('task:updated', updatedTask);
  }

  return res.status(200).json(new ApiResponse(200, updatedTask, 'Task status updated successfully.'));
});