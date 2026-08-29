import { Worker } from 'bullmq';
import mongoose from 'mongoose';
import redis from '../db/redis.js';
import { TaxCertificate } from '../models/taxCertificate.model.js';
import { Payslip } from '../models/payslip.model.js';
import { Employee } from '../models/employee.model.js';
import { Company } from '../models/company.model.js';
import { generateTaxCertificatePdfBuffer } from '../services/taxCertificatePdf.service.js';
import { uploadCertificateFile } from '../services/storage.service.js';

const redisConnection = redis?.options
  ? { host: redis.options.host, port: redis.options.port, password: redis.options.password }
  : { host: '127.0.0.1', port: 6379 };

export const initTaxCertificateWorker = () => {
  const worker = new Worker(
    'tax-certificate-generation',
    async (job) => {
      const { certificateId, companyId, employeeId, taxYear } = job.data;

      // 1. Mark status as PROCESSING
      const certDoc = await TaxCertificate.findById(certificateId);
      if (!certDoc) throw new Error(`Tax Certificate record ${certificateId} not found`);

      certDoc.status = 'PROCESSING';
      await certDoc.save();

      // 2. Resolve Year Range (e.g. "2026-2027" covers July 2026 to June 2027, or single year "2026")
      let monthPrefixes = [];
      if (taxYear.includes('-')) {
        const [startYearStr, endYearStr] = taxYear.split('-');
        const startYear = parseInt(startYearStr, 10);
        const endYear = parseInt(endYearStr, 10);
        for (let m = 7; m <= 12; m++) monthPrefixes.push(`${startYear}-${String(m).padStart(2, '0')}`);
        for (let m = 1; m <= 6; m++) monthPrefixes.push(`${endYear}-${String(m).padStart(2, '0')}`);
      } else {
        for (let m = 1; m <= 12; m++) monthPrefixes.push(`${taxYear}-${String(m).padStart(2, '0')}`);
      }

      // 3. Aggregate ONLY APPROVED / PAID Payslips (Strict Acceptance Criteria)
      const approvedPayslips = await Payslip.find({
        companyId: new mongoose.Types.ObjectId(companyId),
        employeeId: new mongoose.Types.ObjectId(employeeId),
        monthYear: { $in: monthPrefixes },
        status: { $in: ['APPROVED', 'PAID', 'GENERATED'] }, // Only approved payroll runs
      }).sort({ monthYear: 1 });

      let totalGross = 0;
      let totalTax = 0;
      const breakdown = [];

      approvedPayslips.forEach((slip) => {
        const gross = Number(slip.earnings?.grossPay || slip.grossPay || 0);
        const tax = Number(slip.deductions?.incomeTax || slip.deductions?.taxDeduction || slip.incomeTax || 0);

        totalGross += gross;
        totalTax += tax;

        breakdown.push({
          monthYear: slip.monthYear,
          grossPay: gross,
          taxDeduction: tax,
          payslipId: slip._id,
        });
      });

      // 4. Fetch Employee & Company Profile Details
      const employee = await Employee.findById(employeeId);
      const company = await Company.findById(companyId);

      const certNumber = `TC-${taxYear}-${employee?.employeeId || employeeId.slice(-4)}-${Date.now().toString().slice(-4)}`;
      const issueDate = new Date().toISOString().split('T')[0];

      // 5. Generate PDF
      const pdfBuffer = await generateTaxCertificatePdfBuffer({
        certificateNumber: certNumber,
        companyName: company?.name || 'Company',
        companyNTN: company?.settings?.taxNTN || '1002341-9',
        employeeName: `${employee?.firstName || ''} ${employee?.lastName || ''}`.trim() || 'Employee',
        employeeCode: employee?.employeeId || 'EMP',
        employeeCNIC: employee?.cnic || employee?.taxId || 'N/A',
        employeeDesignation: employee?.designation || 'Staff',
        taxYear,
        totalGrossIncome: totalGross,
        totalTaxPaid: totalTax,
        monthlyBreakdown: breakdown,
        issueDate,
      });

      // 6. Upload to S3 / Storage
      const storageKey = `tax-certificates/${companyId}/${taxYear}/tax-cert-${employeeId}.pdf`;
      const uploadResult = await uploadCertificateFile(pdfBuffer, storageKey, 'application/pdf');

      // 7. Update Record to COMPLETED
      certDoc.certificateNumber = certNumber;
      certDoc.totalGrossIncome = mongoose.Types.Decimal128.fromString(totalGross.toFixed(2));
      certDoc.totalTaxPaid = mongoose.Types.Decimal128.fromString(totalTax.toFixed(2));
      certDoc.monthlyBreakdown = breakdown;
      certDoc.s3Key = uploadResult.s3Key;
      certDoc.s3Url = uploadResult.s3Url;
      certDoc.status = 'COMPLETED';
      certDoc.generatedAt = new Date();
      await certDoc.save();

      return { certificateId: certDoc._id, s3Key: uploadResult.s3Key, totalTaxPaid: totalTax };
    },
    { connection: redisConnection }
  );

  worker.on('failed', async (job, err) => {
    console.error(`❌ Tax Certificate Job ${job?.id} failed:`, err);
    if (job?.data?.certificateId) {
      await TaxCertificate.findByIdAndUpdate(job.data.certificateId, {
        status: 'FAILED',
        errorMessage: err.message,
      });
    }
  });

  return worker;
};