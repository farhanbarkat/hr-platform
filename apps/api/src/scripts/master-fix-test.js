import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Company } from '../models/company.model.js';
import { User } from '../models/user.model.js';
import { Employee } from '../models/employee.model.js';
import { Department } from '../models/department.model.js';

dotenv.config();

const run = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hr_platform';
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB...\n');

  // 1. Pick or verify main company (Cloud Logic)
  let company = await Company.findOne({ name: 'Cloud Logic' });
  if (!company) {
    company = await Company.findOne({});
  }
  company.isActive = true;
  await company.save();

  const companyId = company._id;

  // 2. Sync HR User
  let hrUser = await User.findOne({ email: 'hr@cloudlogic.com' });
  if (hrUser) {
    hrUser.companyId = companyId;
    hrUser.role = 'HR';
    await hrUser.save();
  }

  // 3. Ensure a Department exists
  let department = await Department.findOne({ companyId, name: 'Engineering' });
  if (!department) {
    department = await Department.create({
      companyId,
      name: 'Engineering',
      description: 'Software Team',
      isActive: true,
    });
  }

  // 4. Ensure an Employee exists under this company
  let employee = await Employee.findOne({ companyId });
  if (!employee) {
    employee = await Employee.create({
      companyId,
      firstName: 'Farhan',
      lastName: 'Barkat',
      email: 'farhan@cloudlogic.com',
      designation: 'Software Engineer',
      dateOfJoining: new Date(),
      employmentStatus: 'ACTIVE',
    });
  }

  console.log('====================================================');
  console.log('🎯 COPY PASTE THESE EXACT VALUES IN POSTMAN');
  console.log('====================================================');
  console.log(`1. COMPANY ID   : ${companyId.toString()} (${company.name})`);
  console.log(`2. HR EMAIL     : hr@cloudlogic.com`);
  console.log(`3. EMPLOYEE ID  : ${employee._id.toString()}`);
  console.log(`4. DEPARTMENT ID: ${department._id.toString()}`);
  console.log('====================================================');
  console.log(`POSTMAN URL:`);
  console.log(`PATCH http://localhost:5000/api/v1/departments/employees/${employee._id.toString()}/reassign`);
  console.log(`\nPOSTMAN BODY:`);
  console.log(JSON.stringify({ departmentId: department._id.toString() }, null, 2));
  console.log('====================================================\n');

  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});