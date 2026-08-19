import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { User } from '../models/user.model.js';

async function resetSpecificAdmin() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI .env file mein nahi mila!');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('📦 Connected to Database...');

    // Find specific user by email
    const user = await User.findOne({ email: 'admin@cloudlogic.com' });

    if (user) {
      // Reset password and clear account lockout
      user.password = 'Admin@12345';
      user.failedLoginAttempts = 0;
      user.lockUntil = null;

      await user.save();

      console.log('====================================');
      console.log('✅ Account Unlocked & Password Reset!');
      console.log('📧 Email:', user.email);
      console.log('🔑 New Password: Admin@12345');
      console.log('🔓 Lockout Status: Cleared');
      console.log('====================================');
    } else {
      console.log('❌ User admin@cloudlogic.com nahi mila.');
    }
  } catch (error) {
    console.error('❌ Error occurred:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

resetSpecificAdmin();