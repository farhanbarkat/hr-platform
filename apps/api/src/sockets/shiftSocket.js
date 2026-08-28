/**
 * Emits live check-in / check-out updates to monitored shift rooms
 * @param {object} io - Socket.io Server instance
 * @param {string} companyId - Tenant Company ID
 * @param {string} inchargeId - Shift Incharge Employee ID
 * @param {object} payload - Live check-in payload
 */
export const emitShiftAttendanceUpdate = (io, companyId, inchargeId, payload) => {
  if (!io) return;

  // 1. Broadcast to specific incharge room
  if (inchargeId) {
    io.to(`company_${companyId}_incharge_${inchargeId}`).emit('shift:attendance_update', payload);
  }

  // 2. Broadcast to company HR/Admin live monitoring room
  io.to(`company_${companyId}_admins`).emit('shift:attendance_update', payload);
};