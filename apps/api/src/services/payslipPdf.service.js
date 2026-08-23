import PDFDocument from 'pdfkit';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Payslip } from '../models/payslip.model.js';
import { ApiError } from '../utils/ApiError.js';
import fs from 'fs';
import path from 'path';

const hasValidAwsConfig =
  Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) &&
  process.env.AWS_ACCESS_KEY_ID.trim() !== '' &&
  process.env.AWS_SECRET_ACCESS_KEY.trim() !== '';

let s3Client = null;
if (hasValidAwsConfig) {
  s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
}

export class PayslipPdfService {
  static async buildPayslipPdfBuffer(payslip, employee, company) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Header Banner
      doc.fontSize(18).font('Helvetica-Bold').text(company?.name || 'CLOUDLOGIC TECHNOLOGIES', { align: 'center' });
      doc.fontSize(10).font('Helvetica').text(`Pay Period: ${payslip.period?.month || 8}/${payslip.period?.year || 2026}`, { align: 'center' });
      doc.moveDown(1.5);

      // Employee Info Grid
      doc.fontSize(11).font('Helvetica-Bold').text('EMPLOYEE DETAILS');
      doc.font('Helvetica').fontSize(9);
      const empName = employee ? `${employee.firstName || ''} ${employee.lastName || ''}`.trim() : 'N/A';
      doc.text(`Name: ${empName}`);
      doc.text(`Employee ID: ${employee?._id || payslip.employeeId}`);
      doc.text(`Status: ${payslip.status}`);
      doc.moveDown(1);

      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke('#E2E8F0');
      doc.moveDown(1);

      // Financials Breakdown Table
      doc.font('Helvetica-Bold').fontSize(11).text('EARNINGS & DEDUCTIONS BREAKDOWN', 40, doc.y);
      doc.moveDown(0.5);

      const tableTop = doc.y;
      doc.font('Helvetica-Bold').fontSize(9);
      doc.text('Description', 40, tableTop);
      doc.text('Amount (PKR)', 430, tableTop, { align: 'right' });

      doc.moveTo(40, tableTop + 14).lineTo(555, tableTop + 14).stroke('#CBD5E1');

      let currentY = tableTop + 20;

      const formatDecimal = (val) => {
        if (!val) return '0.00';
        if (typeof val === 'object' && val.$numberDecimal) return parseFloat(val.$numberDecimal).toFixed(2);
        return parseFloat(val.toString()).toFixed(2);
      };

      const printRow = (label, value) => {
        doc.font('Helvetica').fontSize(9).text(label, 40, currentY);
        // Design System Monospace typography for numeric values (IBM Plex Mono / Courier)
        doc.font('Courier-Bold').fontSize(9).text(formatDecimal(value), 430, currentY, { align: 'right' });
        currentY += 16;
      };

      printRow('Basic Salary', payslip.earnings?.basicSalary);
      printRow('Allowances', payslip.earnings?.allowances);
      printRow('Overtime Pay', payslip.earnings?.overtimePay);
      printRow('Gross Earnings', payslip.earnings?.grossPay);
      printRow('Late Deductions', payslip.deductions?.lateDeductions);
      printRow('Unpaid Leave Deductions', payslip.deductions?.unpaidLeaveDeductions);
      printRow('Tax Deductions', payslip.deductions?.taxPlaceholder);
      printRow('Total Deductions', payslip.deductions?.totalDeductions);

      doc.moveTo(40, currentY + 4).lineTo(555, currentY + 4).stroke('#0F172A');
      currentY += 10;

      // Net Pay
      doc.font('Helvetica-Bold').fontSize(11).text('NET SALARY PAYABLE:', 40, currentY);
      doc.font('Courier-Bold').fontSize(12).text(
        `PKR ${formatDecimal(payslip.netPay)}`,
        350,
        currentY,
        { align: 'right' }
      );

      doc.end();
    });
  }

  static async generateAndUploadPayslip(payslipId) {
    const payslip = await Payslip.findById(payslipId)
      .populate('employeeId')
      .populate('companyId');

    if (!payslip) throw new ApiError(404, 'Payslip not found');

    const pdfBuffer = await this.buildPayslipPdfBuffer(
      payslip,
      payslip.employeeId,
      payslip.companyId
    );

    const s3Key = `payslips/${payslip.companyId?._id || payslip.companyId}/${payslip._id}.pdf`;
    const bucketName = process.env.AWS_S3_BUCKET || 'hrms-payslips-bucket';

    let pdfUrl = '';
    if (hasValidAwsConfig && s3Client) {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: s3Key,
          Body: pdfBuffer,
          ContentType: 'application/pdf',
        })
      );
      pdfUrl = `https://${bucketName}.s3.amazonaws.com/${s3Key}`;
    } else {
      // Local fallback storage for development environment
      const uploadsDir = path.resolve('public', 'temp', 'payslips');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      const localFilePath = path.join(uploadsDir, `${payslip._id}.pdf`);
      fs.writeFileSync(localFilePath, pdfBuffer);
      pdfUrl = `http://localhost:5000/temp/payslips/${payslip._id}.pdf`;
    }

    // Atomic update targeting only whitelisted PDF fields with clean bypass option
    const updatedPayslip = await Payslip.findByIdAndUpdate(
      payslipId,
      {
        $set: {
          pdfS3Key: s3Key,
          pdfUrl: pdfUrl,
          pdfGeneratedAt: new Date(),
        },
      },
      { 
        new: true, 
        bypassImmutability: true // High-priority system bypass context passed here
      }
    );

    return updatedPayslip;
  }

  static async getDownloadUrl(payslipId, user) {
    const payslip = await Payslip.findById(payslipId);
    if (!payslip) throw new ApiError(404, 'Payslip not found');

    const isOwner = user.employeeId && payslip.employeeId.toString() === user.employeeId.toString();
    const isHrOrAdmin = ['COMPANY_ADMIN', 'HR', 'SUPER_ADMIN'].includes(user.role);

    if (!isOwner && !isHrOrAdmin) {
      throw new ApiError(403, 'Forbidden: You can only download your own payslip.');
    }

    if (!hasValidAwsConfig || !s3Client) {
      return {
        downloadUrl: payslip.pdfUrl || `http://localhost:5000/temp/payslips/${payslipId}.pdf`,
        s3Key: payslip.pdfS3Key,
      };
    }

    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET || 'hrms-payslips-bucket',
      Key: payslip.pdfS3Key,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });
    return { downloadUrl: presignedUrl, s3Key: payslip.pdfS3Key };
  }
}