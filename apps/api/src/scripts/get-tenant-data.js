import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Department } from '../models/department.model.js';
import { Employee } from '../models/employee.model.js';

dotenv.config();

const checkData = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hr_platform';
  await mongoose.connect(mongoUri);

  const companyId = '6a80784392254a5e86867255'; // Apex Global Tech

  const departments = await Department.find({ companyId }, '_id name isActive');
  console.log('--- 🏢 DEPARTMENTS FOR APEX GLOBAL ---');
  console.log(departments);

  const employees = await Employee.find({ companyId }, '_id firstName lastName email departmentId');
  console.log('--- 👥 EMPLOYEES FOR APEX GLOBAL ---');
  console.log(employees);

  process.exit(0);
};

checkData();