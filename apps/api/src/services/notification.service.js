import { Company } from '../models/company.model.js';
import { Employee } from '../models/employee.model.js';
import { Notification } from '../models/notification.model.js';
import { notificationQueue } from '../queues/notification.queue.js';

export class NotificationService {
  /**
   * Unified Dispatcher (In-App DB Save + Email Queue + Logging)
   */
  static async sendNotification({
    companyId = null,
    recipientId,
    title,
    message,
    data = {},
    type = 'INFO',
    category = 'SYSTEM',
    channels = ['IN_APP'],
    emailDetails = null, // { to, subject, html, text }
  }) {
    console.log(`\n======================================================`);
    console.log(`[NOTIFICATION SERVICE] [${type}] [Channels: ${channels.join(', ')}]`);
    console.log(`To Recipient: ${recipientId}`);
    console.log(`Title: ${title}`);
    console.log(`Message: ${message}`);
    console.log(`Payload Data:`, data);
    console.log(`======================================================\n`);

    let savedNotification = null;

    // 1. In-App Notification (Database mein save karna for Notification Bell)
    if (channels.includes('IN_APP') && recipientId) {
      try {
        // Agar companyId pass nahi hui to recipient employee/user se resolve karlein
        let resolvedCompanyId = companyId;
        if (!resolvedCompanyId) {
          const emp = await Employee.findOne({ $or: [{ userId: recipientId }, { _id: recipientId }] });
          resolvedCompanyId = emp?.companyId || null;
        }

        if (resolvedCompanyId) {
          savedNotification = await Notification.create({
            companyId: resolvedCompanyId,
            recipientId,
            title,
            message,
            type,
            category,
            data,
            channels,
            emailDeliveryStatus: channels.includes('EMAIL') ? 'PENDING' : 'NOT_REQUESTED',
          });
        }
      } catch (err) {
        console.error('[NotificationService] In-App Notification DB save failed:', err.message);
      }
    }

    // 2. Email Channel (BullMQ Job Queue with Retry Backoff)
    if (channels.includes('EMAIL') && emailDetails?.to) {
      try {
        await notificationQueue.add('send-email', {
          channel: 'EMAIL',
          notificationId: savedNotification?._id,
          payload: {
            to: emailDetails.to,
            subject: emailDetails.subject || title,
            text: emailDetails.text || message,
            html: emailDetails.html,
          },
        });
      } catch (err) {
        console.error('[NotificationService] Failed to queue email job:', err.message);
      }
    }

    // 3. Push & SMS Stubs (Phase 4 scope)
    if (channels.includes('PUSH')) {
      console.log(`[PUSH STUB] Push notification dispatched for user ${recipientId}`);
    }
    if (channels.includes('SMS')) {
      console.log(`[SMS STUB] SMS dispatched for user ${recipientId}`);
    }

    return {
      success: true,
      deliveredAt: new Date(),
      notification: savedNotification,
    };
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

      let managerUserId = employee.managerId || employee.manager || employee.reportsTo;

      if (managerUserId) {
        const managerDoc = await Employee.findById(managerUserId);
        if (managerDoc && managerDoc.userId) {
          managerUserId = managerDoc.userId;
        }
      } else {
        managerUserId = employee.userId || employee._id;
      }

      await this.sendNotification({
        companyId,
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
        category: 'ATTENDANCE',
        channels: ['IN_APP'],
      });

      return { alertSent: true, managerId: managerUserId, threshold };
    }

    return { alertSent: false, threshold };
  }

 /**
   * TICKET-021: Broadcast announcement notifications to target audience employees
   */
  static async notifyAnnouncement({ announcement, companyId }) {
    let query = { companyId };

    // Case-insensitive active check
    if (announcement.targetAudience === 'department' && announcement.targetDepartmentId) {
      query.departmentId = announcement.targetDepartmentId;
    } else if (announcement.targetAudience === 'team' && announcement.targetTeamId) {
      query.teamId = announcement.targetTeamId;
    }

    const employees = await Employee.find(query).select('_id userId email firstName lastName');

    // Collect recipient user IDs
    const recipientUserIds = new Set();

    employees.forEach((emp) => {
      if (emp.userId) {
        recipientUserIds.add(emp.userId.toString());
      } else {
        recipientUserIds.add(emp._id.toString());
      }
    });

    // For company-wide ("all") announcements, ensure all registered company users receive it
    if (announcement.targetAudience === 'all') {
      const { User } = await import('../models/user.model.js');
      const companyUsers = await User.find({ companyId }).select('_id');
      companyUsers.forEach((u) => recipientUserIds.add(u._id.toString()));
    }

    for (const userId of recipientUserIds) {
      await this.sendNotification({
        companyId,
        recipientId: userId,
        title: `📢 Announcement: ${announcement.title}`,
        message:
          announcement.body.length > 120
            ? `${announcement.body.slice(0, 117)}...`
            : announcement.body,
        data: {
          announcementId: announcement._id,
          targetAudience: announcement.targetAudience,
          priority: announcement.priority,
        },
        type: announcement.priority === 'urgent' ? 'WARNING' : 'INFO',
        category: 'ANNOUNCEMENT',
        channels: ['IN_APP'],
      });
    }

    return {
      success: true,
      recipientCount: recipientUserIds.size,
      targetAudience: announcement.targetAudience,
    };
  }
}