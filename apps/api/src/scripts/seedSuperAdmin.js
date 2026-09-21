import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { User } from '../models/user.model.js';
import { Company } from '../models/company.model.js';

dotenv.config({ path: './.env' });

const seedSuperAdmin = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://farhanbarkat33_db_user:Farhan.123@cluster0.haqsjjk.mongodb.net/?appName=Cluster0';
    if (!mongoUri) throw new Error('MONGODB_URI missing');

    console.log('⏳ Connecting to Database...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB.');

    // 1. Ensure System Root Company
    let systemCompany = await Company.findOne({ slug: 'system-root' });
    if (!systemCompany) {
      systemCompany = await Company.create({
        name: 'System Root',
        slug: 'system-root',
        currency: 'USD',
        timezone: 'UTC',
        isActive: true,
      });
    }

    const superAdminEmail = (process.env.SUPERADMIN_EMAIL || 'superadmin@hrplatform.com').toLowerCase();
    const plainPassword = 'Farhan.123@#-=[]'; // Default password for seeding; should be changed after first login

    // Hash manually with salt factor 10
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(plainPassword, salt);

    // Use updateOne with upsert to bypass pre-save hooks completely
    await User.updateOne(
      { email: superAdminEmail },
      {
        $set: {
          firstName: 'System',
          lastName: 'Admin',
          password: hashedPassword,
          role: 'SUPER_ADMIN',
          companyId: systemCompany._id,
          isEmailVerified: true,
          isActive: true,
        },
      },
      { upsert: true }
    );

    console.log('====================================================');
    console.log('🚀 Super Admin Password Forced Cleanly via Direct Mongo Update!');
    console.log(`📧 Email:    ${superAdminEmail}`);
    console.log(`🔑 Password: ${plainPassword}`);
    console.log('====================================================');
  } catch (error) {
    console.error('❌ Error during seeding:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed.');
    process.exit(0);
  }
};

seedSuperAdmin();