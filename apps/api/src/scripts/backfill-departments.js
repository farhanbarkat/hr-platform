import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Company } from '../models/company.model.js';
import { Department } from '../models/department.model.js';
import { Employee } from '../models/employee.model.js';

dotenv.config();

const runMigration = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hr_platform';
    await mongoose.connect(mongoUri);
    console.log('📦 Connected to MongoDB for Department Backfill...');

    const companies = await Company.find({});
    console.log(`🏢 Found ${companies.length} company/companies.`);

    for (const company of companies) {
      // 1. Check or Create default 'Unassigned' department
      let defaultDept = await Department.findOne({
        companyId: company._id,
        name: 'Unassigned',
      });

      if (!defaultDept) {
        defaultDept = await Department.create({
          companyId: company._id,
          name: 'Unassigned',
          description: 'Default department for retrofitted employees',
          headEmployeeId: null,
          isActive: true,
        });
        console.log(`✅ Created default 'Unassigned' department for company: ${company.name || company._id}`);
      } else {
        console.log(`ℹ️ Default 'Unassigned' department already exists for company: ${company.name || company._id}`);
      }

      // 2. Set departmentId on employees where departmentId is null or missing
      const result = await Employee.updateMany(
        {
          companyId: company._id,
          $or: [{ departmentId: null }, { departmentId: { $exists: false } }],
        },
        {
          $set: { departmentId: defaultDept._id },
        }
      );

      console.log(`👥 Updated ${result.modifiedCount} employee(s) to 'Unassigned' department for company: ${company._id}`);
    }

    console.log('🎉 Department migration backfill completed successfully without breaking any records!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

runMigration();