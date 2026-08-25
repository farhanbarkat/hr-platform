import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const fixIndex = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hr_platform';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB...');

    const db = mongoose.connection.db;
    const collection = db.collection('departments');

    // Drop old problematic index
    try {
      await collection.dropIndex('companyId_1_code_1');
      console.log('✅ Successfully dropped old index: companyId_1_code_1');
    } catch (err) {
      console.log('ℹ️ Index companyId_1_code_1 not found or already dropped.');
    }

    console.log('🎉 Done! You can now create departments and run the backfill script.');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

fixIndex();