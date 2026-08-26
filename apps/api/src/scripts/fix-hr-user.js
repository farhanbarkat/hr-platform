import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Company } from '../models/company.model.js';
import { User } from '../models/user.model.js';

dotenv.config();

const fix = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hr_platform';
  await mongoose.connect(mongoUri);

  const company = await Company.findOne({});
  if (!company) {
    console.error('No company found in database! Please create a company first.');
    process.exit(1);
  }

  // Ensure company is active
  company.isActive = true;
  await company.save();

  // Update HR user's companyId and role
  const updatedUser = await User.findOneAndUpdate(
    { email: 'hr@cloudlogic.com' },
    { 
      companyId: company._id,
      role: 'HR'
    },
    { new: true }
  );

  console.log('✅ HR User synced successfully with valid Company ID:');
  console.log({
    userId: updatedUser?._id,
    role: updatedUser?.role,
    companyId: updatedUser?.companyId,
    companyName: company.name
  });

  process.exit(0);
};

fix();