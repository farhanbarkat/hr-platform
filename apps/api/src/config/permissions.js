/**
 * Central Permissions Registry
 * 
 * Single source of truth for all granular permissions in the system.
 * Permissions are strings in the format: `resource.action`
 * 
 * Resources: payroll, leave, employee, company, attendance, task, finance, document, settings
 * Actions: create, read, update, delete, approve, reject, manage, export, configure
 */

export const PERMISSIONS = {
  // Payroll permissions
  PAYROLL: {
    CREATE: 'payroll.create',
    READ: 'payroll.read',
    UPDATE: 'payroll.update',
    DELETE: 'payroll.delete',
    APPROVE: 'payroll.approve',
    RUN: 'payroll.run',
    EXPORT: 'payroll.export',
    VIEW_PAYSLIPS: 'payroll.view_payslips',
    VIEW_OWN_PAYSLIP: 'payroll.view_own_payslip',
  },

  // Leave permissions
  LEAVE: {
    CREATE: 'leave.create',
    READ: 'leave.read',
    UPDATE: 'leave.update',
    DELETE: 'leave.delete',
    APPROVE_MANAGER: 'leave.approve_manager',
    APPROVE_HR: 'leave.approve_hr',
    APPROVE_FINAL: 'leave.approve_final',
    CANCEL: 'leave.cancel',
    VIEW_TEAM: 'leave.view_team',
    VIEW_OWN: 'leave.view_own',
    MANAGE_BALANCES: 'leave.manage_balances',
    MANAGE_HOLIDAYS: 'leave.manage_holidays',
  },

  // Employee permissions
  EMPLOYEE: {
    CREATE: 'employee.create',
    READ: 'employee.read',
    UPDATE: 'employee.update',
    DELETE: 'employee.delete',
    MANAGE: 'employee.manage',
    VIEW_OWN: 'employee.view_own',
    VIEW_TEAM: 'employee.view_team',
    MANAGE_DOCUMENTS: 'employee.manage_documents',
    VIEW_ORG_CHART: 'employee.view_org_chart',
  },

  // Company permissions
  COMPANY: {
    READ: 'company.read',
    UPDATE: 'company.update',
    CONFIGURE: 'company.configure',
    MANAGE_WORKSITES: 'company.manage_worksites',
    MANAGE_ROLES: 'company.manage_roles',
    VIEW_ANALYTICS: 'company.view_analytics',
  },

  // Attendance permissions
  ATTENDANCE: {
    CHECK_IN: 'attendance.check_in',
    CHECK_OUT: 'attendance.check_out',
    READ: 'attendance.read',
    UPDATE: 'attendance.update',
    APPROVE_CORRECTION: 'attendance.approve_correction',
    VIEW_OWN: 'attendance.view_own',
    VIEW_TEAM: 'attendance.view_team',
    EXPORT: 'attendance.export',
    MANAGE_BIOMETRIC: 'attendance.manage_biometric',
  },

  // Task permissions
  TASK: {
    CREATE: 'task.create',
    READ: 'task.read',
    UPDATE: 'task.update',
    DELETE: 'task.delete',
    ASSIGN: 'task.assign',
    APPROVE: 'task.approve',
    VIEW_OWN: 'task.view_own',
    VIEW_TEAM: 'task.view_team',
    MANAGE_BOARDS: 'task.manage_boards',
  },

  // Finance permissions
  FINANCE: {
    CREATE_EXPENSE: 'finance.create_expense',
    CREATE_INCOME: 'finance.create_income',
    READ_EXPENSE: 'finance.read_expense',
    APPROVE_EXPENSE: 'finance.approve_expense',
    CREATE_ADVANCE: 'finance.create_advance',
    APPROVE_ADVANCE: 'finance.approve_advance',
    CREATE_LOAN: 'finance.create_loan',
    APPROVE_LOAN: 'finance.approve_loan',
    VIEW_DASHBOARD: 'finance.view_dashboard',
    VIEW_OWN: 'finance.view_own',
    EXPORT: 'finance.export',
  },

  // Document permissions
  DOCUMENT: {
    UPLOAD: 'document.upload',
    READ: 'document.read',
    DELETE: 'document.delete',
    VIEW_OWN: 'document.view_own',
  },

  // Settings permissions
  SETTINGS: {
    READ: 'settings.read',
    UPDATE: 'settings.update',
    MANAGE_INTEGRATIONS: 'settings.manage_integrations',
  },

    // Calendar permissions
  CALENDAR: {
    READ: 'calendar.read',
    CREATE_COMPANY: 'calendar.create_company',
    CREATE_TEAM: 'calendar.create_team',
    MANAGE: 'calendar.manage',
  },

  // ... existing permissions
  TASKS: {
    READ: 'tasks.read',
    CREATE: 'tasks.create',
    ASSIGN_TEAM: 'tasks.assign_team',
    UPDATE_STATUS: 'tasks.update_status',
    DELETE: 'tasks.delete',
  },

};

/**
 * Default role → permission mappings
 * These are the BASE permissions. Companies can override via RolePermissions collection.
 */
export const DEFAULT_ROLE_PERMISSIONS = {
  SUPER_ADMIN: [
    // Super admin has everything across all companies
    ...Object.values(PERMISSIONS.PAYROLL),
    ...Object.values(PERMISSIONS.LEAVE),
    ...Object.values(PERMISSIONS.EMPLOYEE),
    ...Object.values(PERMISSIONS.COMPANY),
    ...Object.values(PERMISSIONS.ATTENDANCE),
    ...Object.values(PERMISSIONS.TASK),
    ...Object.values(PERMISSIONS.FINANCE),
    ...Object.values(PERMISSIONS.DOCUMENT),
    ...Object.values(PERMISSIONS.SETTINGS),

    ...Object.values(PERMISSIONS.CALENDAR),
  ],

  COMPANY_ADMIN: [
    // Company admin has full control within their company
    ...Object.values(PERMISSIONS.PAYROLL),
    ...Object.values(PERMISSIONS.LEAVE),
    ...Object.values(PERMISSIONS.EMPLOYEE),
    ...Object.values(PERMISSIONS.COMPANY),
    ...Object.values(PERMISSIONS.ATTENDANCE),
    ...Object.values(PERMISSIONS.TASK),
    ...Object.values(PERMISSIONS.FINANCE),
    ...Object.values(PERMISSIONS.DOCUMENT),
    ...Object.values(PERMISSIONS.SETTINGS),

    // Calendar permissions
    PERMISSIONS.CALENDAR.READ,
    PERMISSIONS.CALENDAR.CREATE_COMPANY,
    PERMISSIONS.CALENDAR.CREATE_TEAM,
    PERMISSIONS.CALENDAR.MANAGE,
  ],

  HR: [
    // HR manages people, payroll, leave, attendance
    PERMISSIONS.PAYROLL.READ,
    PERMISSIONS.PAYROLL.APPROVE,
    PERMISSIONS.PAYROLL.RUN,
    PERMISSIONS.PAYROLL.EXPORT,
    PERMISSIONS.PAYROLL.VIEW_PAYSLIPS,

    PERMISSIONS.LEAVE.CREATE,
    PERMISSIONS.LEAVE.READ,
    PERMISSIONS.LEAVE.UPDATE,
    PERMISSIONS.LEAVE.APPROVE_HR,
    PERMISSIONS.LEAVE.APPROVE_FINAL,
    PERMISSIONS.LEAVE.MANAGE_BALANCES,
    PERMISSIONS.LEAVE.MANAGE_HOLIDAYS,
    PERMISSIONS.LEAVE.VIEW_TEAM,

    PERMISSIONS.EMPLOYEE.CREATE,
    PERMISSIONS.EMPLOYEE.READ,
    PERMISSIONS.EMPLOYEE.UPDATE,
    PERMISSIONS.EMPLOYEE.MANAGE,
    PERMISSIONS.EMPLOYEE.MANAGE_DOCUMENTS,
    PERMISSIONS.EMPLOYEE.VIEW_ORG_CHART,

    PERMISSIONS.COMPANY.READ,
    PERMISSIONS.COMPANY.MANAGE_WORKSITES,

    PERMISSIONS.ATTENDANCE.READ,
    PERMISSIONS.ATTENDANCE.UPDATE,
    PERMISSIONS.ATTENDANCE.APPROVE_CORRECTION,
    PERMISSIONS.ATTENDANCE.VIEW_TEAM,
    PERMISSIONS.ATTENDANCE.EXPORT,
    PERMISSIONS.ATTENDANCE.MANAGE_BIOMETRIC,

    PERMISSIONS.FINANCE.READ_EXPENSE,
    PERMISSIONS.FINANCE.APPROVE_EXPENSE,
    PERMISSIONS.FINANCE.APPROVE_ADVANCE,
    PERMISSIONS.FINANCE.APPROVE_LOAN,
    PERMISSIONS.FINANCE.VIEW_DASHBOARD,

    PERMISSIONS.DOCUMENT.READ,

    PERMISSIONS.CALENDAR.READ,
    PERMISSIONS.CALENDAR.CREATE_COMPANY,
    PERMISSIONS.CALENDAR.CREATE_TEAM,
    PERMISSIONS.CALENDAR.MANAGE,
  ],

  MANAGER: [
    // Manager approves leave, manages team tasks, views team attendance
    PERMISSIONS.PAYROLL.VIEW_PAYSLIPS,

    PERMISSIONS.LEAVE.CREATE,
    PERMISSIONS.LEAVE.READ,
    PERMISSIONS.LEAVE.APPROVE_MANAGER,
    PERMISSIONS.LEAVE.VIEW_TEAM,
    PERMISSIONS.LEAVE.VIEW_OWN,

    PERMISSIONS.EMPLOYEE.READ,
    PERMISSIONS.EMPLOYEE.VIEW_TEAM,
    PERMISSIONS.EMPLOYEE.VIEW_ORG_CHART,

    PERMISSIONS.COMPANY.READ,

    PERMISSIONS.ATTENDANCE.READ,
    PERMISSIONS.ATTENDANCE.VIEW_TEAM,
    PERMISSIONS.ATTENDANCE.UPDATE,
    PERMISSIONS.ATTENDANCE.VIEW_OWN,

    PERMISSIONS.TASK.CREATE,
    PERMISSIONS.TASK.READ,
    PERMISSIONS.TASK.UPDATE,
    PERMISSIONS.TASK.ASSIGN,
    PERMISSIONS.TASK.VIEW_TEAM,
    PERMISSIONS.TASK.MANAGE_BOARDS,

    PERMISSIONS.FINANCE.READ_EXPENSE,
    PERMISSIONS.FINANCE.APPROVE_EXPENSE,
    PERMISSIONS.FINANCE.VIEW_OWN,

    PERMISSIONS.DOCUMENT.READ,

    PERMISSIONS.CALENDAR.READ,
    PERMISSIONS.CALENDAR.CREATE_TEAM,
  ],

  EMPLOYEE: [
    // Employee can only act on their own data
    PERMISSIONS.PAYROLL.VIEW_OWN_PAYSLIP,

    PERMISSIONS.LEAVE.CREATE,
    PERMISSIONS.LEAVE.VIEW_OWN,

    PERMISSIONS.EMPLOYEE.VIEW_OWN,

    PERMISSIONS.COMPANY.READ,

    PERMISSIONS.ATTENDANCE.CHECK_IN,
    PERMISSIONS.ATTENDANCE.CHECK_OUT,
    PERMISSIONS.ATTENDANCE.VIEW_OWN,

    PERMISSIONS.TASK.READ,
    PERMISSIONS.TASK.UPDATE,
    PERMISSIONS.TASK.VIEW_OWN,

    PERMISSIONS.FINANCE.CREATE_EXPENSE,
    PERMISSIONS.FINANCE.VIEW_OWN,

    PERMISSIONS.DOCUMENT.UPLOAD,
    PERMISSIONS.DOCUMENT.VIEW_OWN,
    
    PERMISSIONS.CALENDAR.READ,
  ],
};

/**
 * Helper: Get all permission strings as a flat array
 */
export const ALL_PERMISSIONS = Object.values(PERMISSIONS)
  .flatMap(resource => Object.values(resource));

/**
 * Helper: Check if a permission string is valid
 */
export const isValidPermission = (permission) => {
  return ALL_PERMISSIONS.includes(permission);
};

/**
 * Helper: Get permissions for a role (base defaults)
 */
export const getDefaultPermissionsForRole = (role) => {
  return DEFAULT_ROLE_PERMISSIONS[role] || [];
};
