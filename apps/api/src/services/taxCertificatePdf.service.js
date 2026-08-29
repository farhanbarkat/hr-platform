import PDFDocument from 'pdfkit';

/**
 * Generates an Annual Tax Certificate PDF stream/buffer
 * 
 * @param {Object} data - Formatted certificate data (company, employee, breakdown, totals)
 * @returns {Promise<Buffer>} PDF Buffer
 */
export const generateTaxCertificatePdfBuffer = async ({
  certificateNumber,
  companyName,
  companyNTN,
  employeeName,
  employeeCode,
  employeeCNIC,
  employeeDesignation,
  taxYear,
  totalGrossIncome,
  totalTaxPaid,
  monthlyBreakdown,
  issueDate,
}) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers = [];

      doc.on('data', (buffer) => buffers.push(buffer));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      // Header / Banner
      doc.rect(40, 40, 515, 60).fill('#1E293B');
      doc.fillColor('#FFFFFF').fontSize(16).font('Helvetica-Bold')
         .text('ANNUAL SALARY TAX DEDUCTION CERTIFICATE', 50, 52, { align: 'center', width: 495 });
      doc.fontSize(10).font('Helvetica')
         .text(`Tax Year: ${taxYear}  |  Certificate No: ${certificateNumber}`, 50, 75, { align: 'center', width: 495 });

      doc.moveDown(3);

      // Issuer & Employee Meta Box
      const metaTop = 115;
      doc.fillColor('#000000');
      doc.rect(40, metaTop, 515, 95).stroke('#CBD5E1');

      // Left Column - Company
      doc.fontSize(9).font('Helvetica-Bold').text('EMPLOYER / ISSUING AUTHORITY', 50, metaTop + 10);
      doc.font('Helvetica').text(`Company: ${companyName || 'N/A'}`, 50, metaTop + 25);
      doc.text(`NTN / Reg No: ${companyNTN || '1002341-9'}`, 50, metaTop + 40);
      doc.text(`Date of Issue: ${issueDate}`, 50, metaTop + 55);

      // Right Column - Employee
      doc.font('Helvetica-Bold').text('EMPLOYEE / TAXPAYER DETAILS', 300, metaTop + 10);
      doc.font('Helvetica').text(`Name: ${employeeName}`, 300, metaTop + 25);
      doc.text(`Employee Code: ${employeeCode || 'N/A'}`, 300, metaTop + 40);
      doc.text(`CNIC / Tax ID: ${employeeCNIC || 'N/A'}`, 300, metaTop + 55);
      doc.text(`Designation: ${employeeDesignation || 'N/A'}`, 300, metaTop + 70);

      // Monthly Breakdown Table Header
      let tableTop = 230;
      doc.rect(40, tableTop, 515, 20).fill('#F1F5F9');
      doc.fillColor('#334155').fontSize(9).font('Helvetica-Bold');
      doc.text('Sr #', 50, tableTop + 5, { width: 30 });
      doc.text('Month / Period', 90, tableTop + 5, { width: 120 });
      doc.text('Gross Pay (PKR)', 230, tableTop + 5, { width: 130, align: 'right' });
      doc.text('Tax Deducted (PKR)', 380, tableTop + 5, { width: 150, align: 'right' });

      // Rows
      tableTop += 20;
      doc.fillColor('#000000').font('Helvetica');

      if (monthlyBreakdown && monthlyBreakdown.length > 0) {
        monthlyBreakdown.forEach((item, index) => {
          doc.rect(40, tableTop, 515, 18).stroke('#E2E8F0');
          doc.fontSize(8.5);
          doc.text(String(index + 1), 50, tableTop + 5, { width: 30 });
          doc.text(item.monthYear, 90, tableTop + 5, { width: 120 });
          doc.text(Number(item.grossPay || 0).toLocaleString(), 230, tableTop + 5, { width: 130, align: 'right' });
          doc.text(Number(item.taxDeduction || 0).toLocaleString(), 380, tableTop + 5, { width: 150, align: 'right' });
          tableTop += 18;
        });
      } else {
        doc.rect(40, tableTop, 515, 20).stroke('#E2E8F0');
        doc.text('No approved payslips found for this period.', 50, tableTop + 5);
        tableTop += 20;
      }

      // Summary / Totals Row
      doc.rect(40, tableTop, 515, 24).fill('#E2E8F0');
      doc.fillColor('#0F172A').fontSize(9.5).font('Helvetica-Bold');
      doc.text('TOTAL TAX DEDUCTED AT SOURCE:', 50, tableTop + 7, { width: 300 });
      doc.text(`PKR ${Number(totalTaxPaid || 0).toLocaleString()}`, 360, tableTop + 7, { width: 170, align: 'right' });

      // Statutory Declaration & Signature
      const footerTop = tableTop + 50;
      doc.fillColor('#475569').fontSize(8).font('Helvetica-Oblique')
         .text(
           'This certificate is generated electronically under the applicable Income Tax Ordinance rules for salaried individuals. It certifies that the above tax was deducted from salary payments and deposited into the government treasury.',
           40,
           footerTop,
           { width: 515, align: 'justify' }
         );

      doc.fontSize(8.5).font('Helvetica')
         .text('Authorized Signatory / Finance Department', 350, footerTop + 55, { align: 'center', width: 200 });
      doc.moveTo(350, footerTop + 50).lineTo(550, footerTop + 50).stroke('#94A3B8');

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};