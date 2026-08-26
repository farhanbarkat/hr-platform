import { Company } from '../models/company.model.js';
import { Employee } from '../models/employee.model.js';

export class NotificationService {
  /**
   * Generic In-App / Push Dispatcher
   */
  static async sendNotification({ recipientId, title, message, data = {}, type = 'INFO' }) {
    console.log(`\n======================================================`);
    console.log(`[NOTIFICATION SERVICE] [${type}]`);
    console.log(`To Recipient: ${recipientId}`);
    console.log(`Title: ${title}`);
    console.log(`Message: ${message}`);
    console.log(`Payload Data:`, data);
    console.log(`======================================================\n`);
    
    return { success: true, deliveredAt: new Date() };
  }

  /**
   * Checks early checkout threshold and immediately notifies direct manager
   */
  static async checkAndTriggerEarlyCheckoutAlert({ companyId, employeeId, earlyLeaveMinutes, checkOutTime }) {
    const company = await Company.findById(companyId);
    const threshold = company?.settings?.attendance?.earlyCheckoutAlertThresholdMinutes || 30;

    if (earlyLeaveMinutes >= threshold) {
      const employee = await Employee.findById(employeeId);
      if (!employee) return { alertSent: false, reason: 'Employee not found' };

      const employeeName = `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || 'Employee';
      
      // Resolve manager ID across common field naming conventions
      let managerUserId = employee.managerId || employee.manager || employee.reportsTo;

      // Agar employee record me direct managerId nahi to company admin fallback ya manager record fetch
      if (managerUserId) {
        const managerDoc = await Employee.findById(managerUserId);
        if (managerDoc && managerDoc.userId) {
          managerUserId = managerDoc.userId;
        }
      } else {
        // Fallback to notification target
        managerUserId = employee.userId || employee._id;
      }

      await this.sendNotification({
        recipientId: managerUserId,
        title: '🚨 Early Check-out Alert',
        message: `${employeeName} checked out ${earlyLeaveMinutes} minutes early at ${new Date(checkOutTime).toISOString()}. (Threshold: ${threshold} mins)`,
        data: {
          employeeId: employee._id,
          employeeName,
          earlyLeaveMinutes,
          threshold,
          checkOutTime,
        },
        type: 'WARNING',
      });

      return { alertSent: true, managerId: managerUserId, threshold };
    }

    return { alertSent: false, threshold };
  }
}