import mongoose from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { Team } from '../models/team.model.js';
import { TeamDiscussion } from '../models/teamDiscussion.model.js';
import { Employee } from '../models/employee.model.js';
import { Task } from '../models/task.model.js';
import '../models/attendance.model.js';

/**
 * 1. Create Team (Admin / HR / Manager)
 */
export const createTeam = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const { name, department, managerId, members } = req.body;

  if (!name || !managerId) {
    throw new ApiError(400, 'Team name and managerId are required.');
  }

  const existingTeam = await Team.findOne({ companyId, name: name.trim() });
  if (existingTeam) {
    throw new ApiError(409, `Team with name '${name}' already exists.`);
  }

  const team = await Team.create({
    companyId,
    name: name.trim(),
    department: department || '',
    managerId,
    members: members && Array.isArray(members) ? members : [],
    createdBy: req.user._id,
  });

  const populatedTeam = await Team.findById(team._id)
    .populate('managerId', 'firstName lastName email employeeId designation')
    .populate('members', 'firstName lastName email employeeId designation');

  return res.status(201).json(
    new ApiResponse(201, populatedTeam, 'Team created successfully.')
  );
});

/**
 * 2. Post Team Discussion Message (Restricted to Team Members & Manager)
 */
export const postTeamDiscussion = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const { teamId } = req.params;
  const { body, attachments } = req.body;

  if (!body || !body.trim()) {
    throw new ApiError(400, 'Discussion body text is required.');
  }

  const team = await Team.findOne({ _id: teamId, companyId, isActive: true });
  if (!team) {
    throw new ApiError(404, 'Team not found.');
  }

  // Resolve current Employee
  const employee = await Employee.findOne({
    companyId,
    $or: [{ userId: req.user._id }, { _id: req.user.employeeId || req.user._id }],
  });

  if (!employee) {
    throw new ApiError(404, 'Employee record not found for this user.');
  }

  const isManager = team.managerId.toString() === employee._id.toString();
  const isMember = team.members.some((m) => m.toString() === employee._id.toString());
  const isPrivileged = ['COMPANY_ADMIN', 'SUPER_ADMIN', 'HR'].includes(req.user.role);

  if (!isManager && !isMember && !isPrivileged) {
    throw new ApiError(403, 'Access denied. You are neither a member nor the manager of this team.');
  }

  const message = await TeamDiscussion.create({
    companyId,
    teamId: team._id,
    authorId: employee._id,
    body: body.trim(),
    attachments: attachments || [],
  });

  const populated = await TeamDiscussion.findById(message._id).populate(
    'authorId',
    'firstName lastName email employeeId designation'
  );

  return res.status(201).json(
    new ApiResponse(201, populated, 'Message posted to team discussion.')
  );
});

/**
 * 3. Aggregated Team Dashboard (Single Backend Call)
 * Restricted to Team Members, Manager & HR/Admins
 */
export const getTeamDashboard = asyncHandler(async (req, res) => {
  const companyId = new mongoose.Types.ObjectId(req.companyId);
  const { teamId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(teamId)) {
    throw new ApiError(400, 'Invalid team ID.');
  }

  const team = await Team.findOne({ _id: teamId, companyId, isActive: true })
    .populate('managerId', 'firstName lastName email employeeId designation')
    .populate('members', 'firstName lastName email employeeId designation');

  if (!team) {
    throw new ApiError(404, 'Team not found.');
  }

  // Resolve current employee
  const currentEmployee = await Employee.findOne({
    companyId,
    $or: [{ userId: req.user._id }, { _id: req.user.employeeId || req.user._id }],
  });

  // Safe role & membership checks with optional chaining
  const isPrivileged = ['COMPANY_ADMIN', 'SUPER_ADMIN', 'HR'].includes(req.user.role);
  const isManager = currentEmployee && team.managerId?._id?.toString() === currentEmployee._id.toString();
  const isMember = currentEmployee && team.members?.some((m) => m?._id?.toString() === currentEmployee._id.toString());

  if (!isPrivileged && !isManager && !isMember) {
    throw new ApiError(403, 'Access denied. This dashboard is restricted to team members and their manager.');
  }

  // Collect all team personnel IDs safely (Filtering nulls)
  const allTeamMemberIds = [
    ...(team.managerId?._id ? [team.managerId._id] : []),
    ...(team.members || []).map((m) => m._id || m),
  ];

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const todayEnd = new Date();
  todayEnd.setUTCHours(23, 59, 59, 999);

  // Dynamic Mongoose Attendance Model Resolution
  const AttendanceModel =
    mongoose.models.Attendance ||
    mongoose.models.AttendanceRecord ||
    mongoose.model('Attendance');

  // Parallel single-trip fetch: Task Summary, Attendance Snapshot, Discussions
  const [tasks, attendanceRecords, discussions] = await Promise.all([
    // 1. Task Board Summary
    Task.find({
      companyId,
      assigneeId: { $in: allTeamMemberIds },
    }).select('title status priority dueDate assigneeId'),

    // 2. Attendance Snapshot for Today
    AttendanceModel.find({
      companyId,
      employeeId: { $in: allTeamMemberIds },
      date: { $gte: todayStart, $lte: todayEnd },
    }).populate('employeeId', 'firstName lastName employeeId designation'),

    // 3. Discussion Thread (Latest 30 messages)
    TeamDiscussion.find({ teamId: team._id, companyId })
      .populate('authorId', 'firstName lastName email employeeId designation')
      .sort({ createdAt: -1 })
      .limit(30),
  ]);

  // Aggregate Task Summary
  const taskBoardSummary = {
    totalTasks: tasks.length,
    todo: tasks.filter((t) => t.status === 'TODO' || t.status === 'PENDING').length,
    inProgress: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
    inReview: tasks.filter((t) => t.status === 'IN_REVIEW').length,
    completed: tasks.filter((t) => t.status === 'COMPLETED' || t.status === 'DONE').length,
    tasks,
  };

  // Aggregate Attendance Snapshot
  const presentEmployeeIds = new Set(
    attendanceRecords
      .filter((a) => a.status === 'PRESENT' || a.status === 'LATE')
      .map((a) => a.employeeId?._id?.toString())
  );

  const attendanceSnapshot = {
    totalTeamSize: allTeamMemberIds.length,
    presentToday: presentEmployeeIds.size,
    absentToday: Math.max(0, allTeamMemberIds.length - presentEmployeeIds.size),
    records: attendanceRecords,
  };

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        team: {
          _id: team._id,
          name: team.name,
          department: team.department,
          manager: team.managerId,
          members: team.members,
        },
        taskBoardSummary,
        attendanceSnapshot,
        discussions: discussions.reverse(),
      },
      'Team dashboard aggregated successfully.'
    )
  );
});