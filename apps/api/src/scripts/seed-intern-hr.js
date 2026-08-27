import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

import { User } from '../models/user.model.js';
import { Employee } from '../models/employee.model.js';
import { Company } from '../models/company.model.js';

const seedInternHr = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      console.error('❌ MONGODB_URI not found in environment.');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('📦 Connected to MongoDB');

    // ==========================================
    // 1. Find the required company
    // ==========================================

    const company = await Company.findOne({
      $or: [
        { name: 'Cloud Logic' },
        { slug: 'cloud-logic' },
      ],
    });

    if (!company) {
      console.error(
        '❌ Cloud Logic company not found.'
      );
      process.exit(1);
    }

    console.log(
      `🏢 Using Company: ${company.name} (${company._id})`
    );

    // ==========================================
    // 2. HR credentials
    // ==========================================

    const email = 'intern.hr@company.com';
    const password = 'Password@123';

    // ==========================================
    // 3. Remove old Employee
    // ==========================================

    const oldUser = await User.findOne({ email });

    if (oldUser) {
      console.log(`🗑️ Removing old user: ${oldUser.email}`);

      await Employee.deleteMany({
        $or: [
          { userId: oldUser._id },
          { email: oldUser.email },
        ],
      });

      await User.deleteOne({
        _id: oldUser._id,
      });

      console.log('✅ Old User + Employee removed.');
    }

    // ==========================================
    // 4. Create fresh HR User
    // ==========================================

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: 'Zain Ahmed',
      email,
      password: hashedPassword,
      role: 'HR',
      companyId: company._id,
      isEmailVerified: true,
    });

    console.log('✅ Created User:', user.email);

    // ==========================================
    // 5. Create Employee inside same company
    // ==========================================

    const employee = await Employee.create({
      userId: user._id,
      companyId: company._id,

      firstName: 'Zain',
      lastName: 'Ahmed',
      email: user.email,

      employeeId: 'EMP-HR-009',
      employeeCode: 'EMP-HR-009',

      cnic: '35202-1234567-1',

      dateOfJoining: new Date(),
      joiningDate: new Date(),

      designation: 'HR Executive',
      jobTitle: 'Intern HR',

      status: 'ACTIVE',
    });

    console.log(
      '✅ Created Employee:',
      employee.firstName,
      employee.lastName
    );

    // ==========================================
    // 6. Print credentials
    // ==========================================

    console.log('\n=============================================');
    console.log('📋 HR SEED COMPLETED');
    console.log('=============================================');
    console.log(`Company Name   : ${company.name}`);
    console.log(`Company ID     : ${company._id}`);
    console.log(`HR Email       : ${email}`);
    console.log(`HR Password    : ${password}`);
    console.log(`User ID        : ${user._id}`);
    console.log(`Employee ID    : ${employee._id}`);
    console.log(`Employee Code  : ${employee.employeeId}`);
    console.log('=============================================\n');

    await mongoose.disconnect();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error seeding intern HR:', error);

    await mongoose.disconnect();
    process.exit(1);
  }
};

seedInternHr();