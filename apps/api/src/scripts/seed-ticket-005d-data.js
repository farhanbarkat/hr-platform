import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { Plan } from '../models/plan.model.js';
import { BillingRecord } from '../models/billingRecord.model.js';
import { PlatformSupportTicket } from '../models/platformSupportTicket.model.js';
import { PlatformSetting } from '../models/platformSetting.model.js';
import { Company } from '../models/company.model.js';
import { User } from '../models/user.model.js';
import { AuditLog } from '../models/auditLog.model.js';

dotenv.config();

const seed = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hr_platform';
  await mongoose.connect(mongoUri);
  console.log('📦 Connected to MongoDB for TICKET-005D Seeding...');

  const hashedPassword = await bcrypt.hash('SuperPassword123!', 10);

  // 1. Ensure Super-Admin User
  let superAdmin = await User.findOneAndUpdate(
    { email: 'superadmin@hrplatform.com' },
    {
      name: 'Global Super Admin',
      email: 'superadmin@hrplatform.com',
      password: hashedPassword,
      role: 'SUPER_ADMIN',
    },
    { upsert: true, returnDocument: 'after' }
  );

  // 2. Seed Plans
  const starterPlan = await Plan.findOneAndUpdate(
    { code: 'STARTER' },
    {
      name: 'Starter Tier',
      code: 'STARTER',
      employeeLimit: 25,
      price: 15000,
      currency: 'PKR',
      billingCycle: 'MONTHLY',
      features: ['attendance', 'leaves', 'basic_reports'],
      isActive: true,
    },
    { upsert: true, returnDocument: 'after' }
  );

  const enterprisePlan = await Plan.findOneAndUpdate(
    { code: 'ENTERPRISE' },
    {
      name: 'Enterprise Tier',
      code: 'ENTERPRISE',
      employeeLimit: 500,
      price: 80000,
      currency: 'PKR',
      billingCycle: 'MONTHLY',
      features: ['attendance', 'leaves', 'payroll', 'multi_branch', 'audit_logs', 'api_access'],
      isActive: true,
    },
    { upsert: true, returnDocument: 'after' }
  );

  // 3. Find a Company
  const company = (await Company.findOne({ name: 'Cloud Logic' })) || (await Company.findOne({}));
  if (company) {
    // 4. Seed Billing Record
    await BillingRecord.findOneAndUpdate(
      { invoiceNumber: 'INV-2026-001' },
      {
        companyId: company._id,
        planId: enterprisePlan._id,
        billingPeriod: {
          startDate: new Date('2026-08-01'),
          endDate: new Date('2026-08-31'),
        },
        amount: 80000,
        currency: 'PKR',
        status: 'PAID',
        invoiceNumber: 'INV-2026-001',
        notes: 'August 2026 subscription paid via bank transfer.',
        recordedBy: superAdmin._id,
      },
      { upsert: true, returnDocument: 'after' }
    );

    // 5. Seed Support Ticket
    await PlatformSupportTicket.findOneAndUpdate(
      { ticketNumber: 'TICK-1001' },
      {
        ticketNumber: 'TICK-1001',
        companyId: company._id,
        createdBy: superAdmin._id,
        subject: 'Custom Domain SSL Setup',
        description: 'Need assistance pointing custom DNS records for our HR portal.',
        category: 'TECHNICAL',
        priority: 'HIGH',
        status: 'OPEN',
      },
      { upsert: true, returnDocument: 'after' }
    );

    // 6. Seed Sample Audit Log
    if (AuditLog) {
      await AuditLog.create({
        companyId: company._id,
        performedBy: superAdmin._id,
        action: 'SUPER_ADMIN_IMPERSONATION',
        targetResource: 'Company',
        targetId: company._id,
        details: { reason: 'Investigating billing discrepancy' },
        ipAddress: '127.0.0.1',
      }).catch(() => {});
    }
  }

  // 7. Seed System Settings & Feature Flags
  await PlatformSetting.findOneAndUpdate(
    { key: 'DEFAULT_TRIAL_DAYS' },
    { key: 'DEFAULT_TRIAL_DAYS', value: 14, description: 'Default free trial duration in days.', isPublic: true },
    { upsert: true, returnDocument: 'after' }
  );

  await PlatformSetting.findOneAndUpdate(
    { key: 'FEATURE_FLAGS' },
    {
      key: 'FEATURE_FLAGS',
      value: { enablePayrollEngine: true, enableBiometricSync: true, maintenanceMode: false },
      description: 'Platform wide feature toggles',
      isPublic: false,
    },
    { upsert: true, returnDocument: 'after' }
  );

  console.log('\n========================================================');
  console.log('✅ TICKET-005D SEED DATA INITIALIZED!');
  console.log('========================================================');
  console.log(`👤 Super Admin  : superadmin@hrplatform.com (PW: SuperPassword123!)`);
  console.log(`📋 Starter Plan : ${starterPlan._id} (${starterPlan.name})`);
  console.log(`📋 Enterprise   : ${enterprisePlan._id} (${enterprisePlan.name})`);
  console.log('========================================================\n');

  process.exit(0);
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});