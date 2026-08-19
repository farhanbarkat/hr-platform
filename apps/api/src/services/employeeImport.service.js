import { Readable } from 'stream';
import csv from 'csv-parser';
import crypto from 'crypto';
import { Employee } from '../models/employee.model.js';
import { User } from '../models/user.model.js';

/**
 * Parses raw CSV buffer into an array of row objects
 */
export const parseCsvBuffer = (buffer) => {
  return new Promise((resolve, reject) => {
    const rows = [];
    const stream = Readable.from(buffer);

    stream
      .pipe(
        csv({
          mapHeaders: ({ header }) => header.trim().replace(/^[\uFEFF]/, ''), // Strip BOM & spaces
        })
      )
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', (err) => reject(err));
  });
};

/**
 * Validates and processes employee rows with per-row failure isolation
 */
export const processEmployeeRows = async (rows, companyId) => {
  const summary = {
    totalRows: rows.length,
    successfulCount: 0,
    failedCount: 0,
    successful: [],
    failed: [],
  };

  // In-memory sets to catch duplicates within the same CSV upload
  const seenCnicsInCsv = new Set();
  const seenEmailsInCsv = new Set();
  const seenEmpIdsInCsv = new Set();

  for (let index = 0; index < rows.length; index++) {
    const rowNumber = index + 1;
    const row = rows[index];

    const firstName = row.firstName?.trim();
    const lastName = row.lastName?.trim();
    const email = row.email?.trim().toLowerCase();
    const cnic = row.cnic?.trim();
    const employeeId = row.employeeId?.trim();
    const department = row.department?.trim();
    const designation = row.designation?.trim();
    const phone = row.phone?.trim() || '';
    const dateOfJoining = row.dateOfJoining ? new Date(row.dateOfJoining.trim()) : null;
    const employmentStatus = row.employmentStatus?.trim().toUpperCase() || 'PROBATION';

    // 1. Mandatory Field Validations
    if (!firstName || !lastName || !email || !cnic || !employeeId || !department || !designation) {
      summary.failedCount++;
      summary.failed.push({
        rowNumber,
        data: row,
        error: 'Missing required fields (firstName, lastName, email, cnic, employeeId, department, designation are mandatory).',
      });
      continue;
    }

    if (!dateOfJoining || isNaN(dateOfJoining.getTime())) {
      summary.failedCount++;
      summary.failed.push({
        rowNumber,
        data: row,
        error: 'Invalid or missing dateOfJoining (Format: YYYY-MM-DD).',
      });
      continue;
    }

    // 2. Intra-CSV Duplicate Checks
    if (seenCnicsInCsv.has(cnic)) {
      summary.failedCount++;
      summary.failed.push({
        rowNumber,
        data: row,
        error: `Duplicate CNIC '${cnic}' found within the same CSV file.`,
      });
      continue;
    }

    if (seenEmailsInCsv.has(email)) {
      summary.failedCount++;
      summary.failed.push({
        rowNumber,
        data: row,
        error: `Duplicate Email '${email}' found within the same CSV file.`,
      });
      continue;
    }

    if (seenEmpIdsInCsv.has(employeeId)) {
      summary.failedCount++;
      summary.failed.push({
        rowNumber,
        data: row,
        error: `Duplicate Employee ID '${employeeId}' found within the same CSV file.`,
      });
      continue;
    }

    // 3. Database Company-Scoped Uniqueness Checks
    const existingEmployee = await Employee.findOne({
      companyId,
      $or: [{ cnic }, { email }, { employeeId }],
    });

    if (existingEmployee) {
      let duplicateField = 'Record';
      if (existingEmployee.cnic === cnic) duplicateField = `CNIC '${cnic}'`;
      else if (existingEmployee.email === email) duplicateField = `Email '${email}'`;
      else if (existingEmployee.employeeId === employeeId) duplicateField = `Employee ID '${employeeId}'`;

      summary.failedCount++;
      summary.failed.push({
        rowNumber,
        data: row,
        error: `${duplicateField} already exists in your company.`,
      });
      continue;
    }

    // Check globally unique User account
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      summary.failedCount++;
      summary.failed.push({
        rowNumber,
        data: row,
        error: `User account with email '${email}' already exists.`,
      });
      continue;
    }

    // 4. Create User & Employee atomically per row
    try {
      const tempPassword = crypto.randomBytes(6).toString('hex') + 'A1!';

      const newUser = await User.create({
        firstName,
        lastName,
        email,
        password: tempPassword,
        role: 'EMPLOYEE',
        companyId,
        isEmailVerified: true,
      });

      const newEmployee = await Employee.create({
        companyId,
        userId: newUser._id,
        firstName,
        lastName,
        email,
        cnic,
        phone,
        employeeId,
        department,
        designation,
        dateOfJoining,
        employmentStatus,
      });

      // Record in local de-dup trackers
      seenCnicsInCsv.add(cnic);
      seenEmailsInCsv.add(email);
      seenEmpIdsInCsv.add(employeeId);

      summary.successfulCount++;
      summary.successful.push({
        rowNumber,
        employeeId: newEmployee.employeeId,
        email: newEmployee.email,
        name: `${newEmployee.firstName} ${newEmployee.lastName}`,
        department: newEmployee.department,
        designation: newEmployee.designation,
        tempPassword,
      });
    } catch (err) {
      summary.failedCount++;
      summary.failed.push({
        rowNumber,
        data: row,
        error: err.message || 'Database error during record insertion.',
      });
    }
  }

  return summary;
};