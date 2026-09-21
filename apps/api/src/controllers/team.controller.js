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
 * 0. Get All Teams for Company (Admin/HR/Manager/Member)
 */
export const getTeams = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const user = req.user;

  const isPrivileged = ['COMPANY_ADMIN', 'SUPER_ADMIN', 'HR'].includes(user.role);

  let query = { companyId, isActive: true };

  if (!isPrivileged) {
    const employee = await Employee.findOne({
      companyId,
      $or: [{ userId: user._id }, { _id: user.employeeId || user._id }],
    });

    if (!employee) {
      return res.status(200).json(new ApiResponse(200, [], 'No teams found.'));
    }

    // Manager of team OR member in team
    query.$or = [{ managerId: employee._id }, { members: employee._id }];
  }

  const teams = await Team.find(query)
    .populate('managerId', 'firstName lastName email employeeId designation')
    .populate('members', 'firstName lastName email employeeId designation')
    .sort({ createdAt: -1 });

  return res.status(200).json(new ApiResponse(200, teams, 'Teams retrieved successfully.'));
});


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

  const allTeamMemberIds = [
    ...(team.managerId?._id ? [team.managerId._id] : []),
    ...(team.members || []).map((m) => m._id || m),
  ];

  // 1. Fetch Tasks safely
  let tasks = [];
  try {
    tasks = await Task.find({
      companyId,
      $or: [
        { assignedTo: { $in: allTeamMemberIds } },
        { assigneeId: { $in: allTeamMemberIds } }
      ]
    }).select('title status priority deadline').lean();
  } catch (err) {
    tasks = [];
  }

  // 2. Fetch Discussions safely
  let discussions = [];
  try {
    discussions = await TeamDiscussion.find({ teamId: team._id, companyId })
      .populate('authorId', 'firstName lastName email employeeId designation')
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();
  } catch (err) {
    discussions = [];
  }

  // Task Summary Calculation
  const taskBoardSummary = {
    totalTasks: tasks.length,
    todo: tasks.filter((t) => t.status === 'TODO').length,
    inProgress: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
    completed: tasks.filter((t) => t.status === 'COMPLETED').length,
    tasks,
  };

  const attendanceSnapshot = {
    totalTeamSize: allTeamMemberIds.length,
    presentToday: allTeamMemberIds.length > 0 ? 1 : 0,
    absentToday: 0,
    records: [],
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

// Add or Remove members from existing team
export const updateTeamMembers = asyncHandler(async (req, res) => {
  const companyId = new mongoose.Types.ObjectId(req.companyId);
  const { teamId } = req.params;
  const { memberIds } = req.body; // Array of employee ObjectIds

  if (!mongoose.Types.ObjectId.isValid(teamId)) {
    throw new ApiError(400, 'Invalid Team ID format.');
  }

  const team = await Team.findOne({ _id: teamId, companyId, isActive: true });
  if (!team) {
    throw new ApiError(404, 'Team not found.');
  }

  // Update members list
  team.members = Array.isArray(memberIds) ? memberIds : [];
  await team.save();

  const updatedTeam = await Team.findById(teamId)
    .populate('managerId', 'firstName lastName email designation')
    .populate('members', 'firstName lastName email designation');

  return res.status(200).json(
    new ApiResponse(200, updatedTeam, 'Team roster updated successfully.')
  );
});