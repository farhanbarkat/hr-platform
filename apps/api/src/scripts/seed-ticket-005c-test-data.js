import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { Company } from '../models/company.model.js';
import { User } from '../models/user.model.js';
import { Employee } from '../models/employee.model.js';
import { Department } from '../models/department.model.js';

dotenv.config();

const seed = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hr_platform';
  await mongoose.connect(mongoUri);
  console.log('📦 Connected to MongoDB for TICKET-005C Seeding...');

  const company = (await Company.findOne({ name: 'Cloud Logic' })) || (await Company.findOne({}));
  if (!company) {
    console.error('No company found. Please create a company first.');
    process.exit(1);
  }
  const companyId = company._id;
  const hashedPassword = await bcrypt.hash('Password123!', 10);

  // 1. Create Two Departments: Sales & Production
  const salesDept = await Department.findOneAndUpdate(
    { companyId, name: 'Sales' },
    { companyId, name: 'Sales', description: 'Sales & BD Team', isActive: true },
    { upsert: true, returnDocument: 'after' }
  );

  const prodDept = await Department.findOneAndUpdate(
    { companyId, name: 'Production' },
    { companyId, name: 'Production', description: 'Production & Manufacturing', isActive: true },
    { upsert: true, returnDocument: 'after' }
  );

  // 2. Create Manager 1: Ali (Sales Manager)
  const userAli = await User.findOneAndUpdate(
    { email: 'ali.sales@cloudlogic.com' },
    { name: 'Ali Sales', email: 'ali.sales@cloudlogic.com', password: hashedPassword, role: 'MANAGER', companyId },
    { upsert: true, returnDocument: 'after' }
  );
  const empAli = await Employee.findOneAndUpdate(
    { email: 'ali.sales@cloudlogic.com' },
    {
      userId: userAli._id,
      companyId,
      employeeId: 'EMP-SALES-MGR',
      firstName: 'Ali',
      lastName: 'Raza',
      email: 'ali.sales@cloudlogic.com',
      cnic: '35201-1111111-1',
      phone: '+923001111111',
      designation: 'Sales Manager',
      departmentId: salesDept._id,
      employmentStatus: 'ACTIVE',
      dateOfJoining: new Date(),
    },
    { upsert: true, returnDocument: 'after' }
  );

  // 3. Create Manager 2: Usman (Production Manager)
  const userUsman = await User.findOneAndUpdate(
    { email: 'usman.prod@cloudlogic.com' },
    { name: 'Usman Prod', email: 'usman.prod@cloudlogic.com', password: hashedPassword, role: 'MANAGER', companyId },
    { upsert: true, returnDocument: 'after' }
  );
  const empUsman = await Employee.findOneAndUpdate(
    { email: 'usman.prod@cloudlogic.com' },
    {
      userId: userUsman._id,
      companyId,
      employeeId: 'EMP-PROD-MGR',
      firstName: 'Usman',
      lastName: 'Tariq',
      email: 'usman.prod@cloudlogic.com',
      cnic: '35201-2222222-2',
      phone: '+923002222222',
      designation: 'Production Manager',
      departmentId: prodDept._id,
      employmentStatus: 'ACTIVE',
      dateOfJoining: new Date(),
    },
    { upsert: true, returnDocument: 'after' }
  );

  // 4. Create Employee 1: Sales Member
  const empSalesGuy = await Employee.findOneAndUpdate(
    { email: 'bilal.sales@cloudlogic.com' },
    {
      companyId,
      employeeId: 'EMP-SALES-01',
      firstName: 'Bilal',
      lastName: 'SalesExec',
      email: 'bilal.sales@cloudlogic.com',
      cnic: '35201-3333333-3',
      phone: '+923003333333',
      designation: 'Sales Executive',
      departmentId: salesDept._id,
      employmentStatus: 'ACTIVE',
      dateOfJoining: new Date(),
    },
    { upsert: true, returnDocument: 'after' }
  );

  // 5. Create Employee 2: Production Member
  const empProdGuy = await Employee.findOneAndUpdate(
    { email: 'tariq.prod@cloudlogic.com' },
    {
      companyId,
      employeeId: 'EMP-PROD-01',
      firstName: 'Tariq',
      lastName: 'Worker',
      email: 'tariq.prod@cloudlogic.com',
      cnic: '35201-4444444-4',
      phone: '+923004444444',
      designation: 'Production Engineer',
      departmentId: prodDept._id,
      employmentStatus: 'ACTIVE',
      dateOfJoining: new Date(),
    },
    { upsert: true, returnDocument: 'after' }
  );

  console.log('\n========================================================');
  console.log('✅ TICKET-005C SEED COMPLETE!');
  console.log('========================================================');
  console.log(`🏢 Sales Dept ID     : ${salesDept._id}`);
  console.log(`🏢 Production Dept ID: ${prodDept._id}`);
  console.log(`👤 Sales Manager     : ali.sales@cloudlogic.com (PW: Password123!)`);
  console.log(`👤 Production Manager: usman.prod@cloudlogic.com (PW: Password123!)`);
  console.log(`👥 Sales Employee ID : ${empSalesGuy._id}`);
  console.log(`👥 Prod Employee ID  : ${empProdGuy._id}`);
  console.log('========================================================\n');

  process.exit(0);
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});