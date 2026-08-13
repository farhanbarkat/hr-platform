import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { User } from '../models/user.model.js';
import { Company } from '../models/company.model.js';

// Load environment variables (.env file)
dotenv.config({ path: './.env' });

const seedSuperAdmin = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in environment variables.');
    }

    console.log('⏳ Connecting to Database...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB.');

    // 1. Check/Create System Root Company
    let systemCompany = await Company.findOne({ slug: 'system-root' });
    if (!systemCompany) {
      systemCompany = await Company.create({
        name: 'System Root',
        slug: 'system-root',
        currency: 'USD',
        timezone: 'UTC',
        isActive: true,
      });
      console.log('✅ System Root Company created.');
    }

    // 2. Check if Super Admin exists
    const superAdminEmail = (process.env.SUPERADMIN_EMAIL || 'superadmin@hrplatform.com').toLowerCase();
    const existingSuperAdmin = await User.findOne({ email: superAdminEmail });

    if (existingSuperAdmin) {
      console.log(`⚠️  Super Admin account (${superAdminEmail}) already exists!`);
    } else {
      const superAdminPassword = process.env.SUPERADMIN_PASSWORD || 'SuperAdmin@123!';

      await User.create({
        firstName: 'System',
        lastName: 'Admin',
        email: superAdminEmail,
        password: superAdminPassword,
        role: 'SUPER_ADMIN',
        companyId: systemCompany._id,
        isEmailVerified: true,
      });

      console.log('====================================================');
      console.log('🚀 SUPER_ADMIN Account Created Successfully!');
      console.log(`📧 Email:    ${superAdminEmail}`);
      console.log(`🔑 Password: ${superAdminPassword}`);
      console.log('====================================================');
    }
  } catch (error) {
    console.error('❌ Error during seeding:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed.');
    process.exit(0);
  }
};

seedSuperAdmin();