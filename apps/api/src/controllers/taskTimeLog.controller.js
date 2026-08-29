import mongoose from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { TaskTimeLog } from '../models/taskTimeLog.model.js';
import { Task } from '../models/task.model.js';
import { Employee } from '../models/employee.model.js';

/**
 * 1. Start Timer on Task (Guards against multiple active timers for same user)
 */
export const startTimer = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const { taskId, note } = req.body;

  if (!taskId) {
    throw new ApiError(400, 'Task ID is required.');
  }

  // Resolve Employee profile
  const employee = await Employee.findOne({
    companyId,
    $or: [{ userId: req.user._id }, { _id: req.user.employeeId || req.user._id }],
  });

  if (!employee) {
    throw new ApiError(404, 'Employee record not found for this user.');
  }

  // Verify task exists in company
  const task = await Task.findOne({ _id: taskId, companyId });
  if (!task) {
    throw new ApiError(404, 'Task not found.');
  }

  // Guard: Check if employee already has an active running timer on ANY task
  const activeTimer = await TaskTimeLog.findOne({
    companyId,
    employeeId: employee._id,
    isRunning: true,
  }).populate('taskId', 'title');

  if (activeTimer) {
    throw new ApiError(
      400,
      `You already have an active timer running on task: "${activeTimer.taskId?.title || activeTimer.taskId}". Stop it before starting a new one.`
    );
  }

  const timeLog = await TaskTimeLog.create({
    companyId,
    taskId: task._id,
    employeeId: employee._id,
    startedAt: new Date(),
    endedAt: null,
    isRunning: true,
    note: note || '',
  });

  return res.status(201).json(
    new ApiResponse(201, timeLog, 'Timer started successfully.')
  );
});

/**
 * 2. Stop Active Timer
 */
export const stopTimer = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const { timeLogId, taskId, note } = req.body;

  const employee = await Employee.findOne({
    companyId,
    $or: [{ userId: req.user._id }, { _id: req.user.employeeId || req.user._id }],
  });

  if (!employee) {
    throw new ApiError(404, 'Employee record not found.');
  }

  const query = {
    companyId,
    employeeId: employee._id,
    isRunning: true,
  };

  if (timeLogId) query._id = timeLogId;
  if (taskId) query.taskId = taskId;

  const activeTimer = await TaskTimeLog.findOne(query);
  if (!activeTimer) {
    throw new ApiError(404, 'No active running timer found for this task/user.');
  }

  const stopTime = new Date();
  const durationMs = stopTime.getTime() - new Date(activeTimer.startedAt).getTime();
  const durationMinutes = Math.max(1, Math.round(durationMs / (1000 * 60)));

  activeTimer.endedAt = stopTime;
  activeTimer.durationMinutes = durationMinutes;
  activeTimer.isRunning = false;
  if (note) activeTimer.note = note;

  await activeTimer.save();

  return res.status(200).json(
    new ApiResponse(200, activeTimer, `Timer stopped. Logged ${durationMinutes} minutes.`)
  );
});

/**
 * 3. Get Active Timer for Current User
 */
export const getActiveTimer = asyncHandler(async (req, res) => {
  const companyId = req.companyId;

  const employee = await Employee.findOne({
    companyId,
    $or: [{ userId: req.user._id }, { _id: req.user.employeeId || req.user._id }],
  });

  if (!employee) {
    return res.status(200).json(new ApiResponse(200, { activeTimer: null }, 'No active timer.'));
  }

  const activeTimer = await TaskTimeLog.findOne({
    companyId,
    employeeId: employee._id,
    isRunning: true,
  }).populate('taskId', 'title status priority');

  return res.status(200).json(
    new ApiResponse(200, { activeTimer }, 'Active timer fetched successfully.')
  );
});

/**
 * 4. Aggregation Query: Task-level & Employee-level Total Logged Time
 */
export const getTaskTimeSummary = asyncHandler(async (req, res) => {
  const companyId = new mongoose.Types.ObjectId(req.companyId);
  const { taskId, employeeId } = req.query;

  const matchFilter = { companyId, isRunning: false };
  if (taskId) matchFilter.taskId = new mongoose.Types.ObjectId(taskId);
  if (employeeId) matchFilter.employeeId = new mongoose.Types.ObjectId(employeeId);

  const [taskSummary, employeeSummary, rawLogs] = await Promise.all([
    // Aggregate by Task
    TaskTimeLog.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$taskId',
          totalMinutes: { $sum: '$durationMinutes' },
          totalSessions: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'tasks',
          localField: '_id',
          foreignField: '_id',
          as: 'task',
        },
      },
      { $unwind: { path: '$task', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          taskId: '$_id',
          taskTitle: '$task.title',
          totalMinutes: 1,
          totalHours: { $round: [{ $divide: ['$totalMinutes', 60] }, 2] },
          totalSessions: 1,
        },
      },
    ]),

    // Aggregate by Employee
    TaskTimeLog.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$employeeId',
          totalMinutes: { $sum: '$durationMinutes' },
          totalSessions: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'employees',
          localField: '_id',
          foreignField: '_id',
          as: 'employee',
        },
      },
      { $unwind: { path: '$employee', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          employeeId: '$_id',
          employeeName: { $concat: ['$employee.firstName', ' ', '$employee.lastName'] },
          totalMinutes: 1,
          totalHours: { $round: [{ $divide: ['$totalMinutes', 60] }, 2] },
          totalSessions: 1,
        },
      },
    ]),

    // Recent discrete session logs
    TaskTimeLog.find(matchFilter)
      .populate('employeeId', 'firstName lastName employeeId')
      .populate('taskId', 'title')
      .sort({ startedAt: -1 })
      .limit(50),
  ]);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        taskSummary,
        employeeSummary,
        recentLogs: rawLogs,
      },
      'Time tracking aggregation and session logs retrieved.'
    )
  );
});