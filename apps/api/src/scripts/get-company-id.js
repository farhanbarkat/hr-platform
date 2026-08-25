import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Company } from '../models/company.model.js';
import { User } from '../models/user.model.js';

dotenv.config();

const check = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hr_platform';
  await mongoose.connect(mongoUri);

  const companies = await Company.find({}, '_id name email isActive');
  console.log('--- 🏢 EXISTING COMPANIES IN DB ---');
  console.log(companies);

  const users = await User.find({ email: 'hr@cloudlogic.com' }, '_id email role companyId');
  console.log('--- 👤 HR USER IN DB ---');
  console.log(users);

  process.exit(0);
};

check();