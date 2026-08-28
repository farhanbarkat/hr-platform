export const TEMPLATE_TYPES = [
  'offerLetter',
  'promotionLetter',
  'resignationAcceptance',
  'relievingLetter',
  'experienceLetter',
  'warningLetter',
];

export const ALLOWED_PLACEHOLDERS = {
  offerLetter: [
    'employeeName',
    'designation',
    'department',
    'joiningDate',
    'ctc',
    'reportingManager',
    'workLocation',
    'companyName',
    'companyAddress',
    'currentDate',
  ],
  promotionLetter: [
    'employeeName',
    'currentDesignation',
    'newDesignation',
    'department',
    'effectiveDate',
    'newCtc',
    'companyName',
    'currentDate',
  ],
  resignationAcceptance: [
    'employeeName',
    'designation',
    'department',
    'resignationDate',
    'lastWorkingDate',
    'companyName',
    'currentDate',
  ],
  relievingLetter: [
    'employeeName',
    'employeeCode',
    'designation',
    'department',
    'joiningDate',
    'lastWorkingDate',
    'companyName',
    'companyAddress',
    'currentDate',
  ],
  experienceLetter: [
    'employeeName',
    'employeeCode',
    'designation',
    'department',
    'joiningDate',
    'lastWorkingDate',
    'companyName',
    'companyAddress',
    'currentDate',
  ],
  warningLetter: [
    'employeeName',
    'designation',
    'department',
    'incidentDetails',
    'correctiveAction',
    'issueDate',
    'companyName',
    'currentDate',
  ],
};

export const SYSTEM_DEFAULT_TEMPLATES = {
  offerLetter: {
    title: 'Standard Offer Letter',
    bodyContent: `
      <h2>Employment Offer Letter</h2>
      <p>Date: {{currentDate}}</p>
      <p>Dear <strong>{{employeeName}}</strong>,</p>
      <p>We are pleased to offer you the position of <strong>{{designation}}</strong> in the <strong>{{department}}</strong> department at <strong>{{companyName}}</strong>.</p>
      <p>Your scheduled joining date will be <strong>{{joiningDate}}</strong> with an annual compensation (CTC) of <strong>{{ctc}}</strong>, reporting to <strong>{{reportingManager}}</strong> at our <strong>{{workLocation}}</strong> office.</p>
      <p>Please sign and return the duplicate copy of this letter as confirmation of your acceptance.</p>
      <br/><p>Sincerely,<br/><strong>{{companyName}}</strong><br/>{{companyAddress}}</p>
    `,
  },
  promotionLetter: {
    title: 'Standard Promotion Letter',
    bodyContent: `
      <h2>Letter of Promotion</h2>
      <p>Date: {{currentDate}}</p>
      <p>Dear <strong>{{employeeName}}</strong>,</p>
      <p>In recognition of your continued dedication and performance as <strong>{{currentDesignation}}</strong>, we are pleased to promote you to <strong>{{newDesignation}}</strong> in the <strong>{{department}}</strong> department, effective from <strong>{{effectiveDate}}</strong>.</p>
      <p>Your revised compensation will be <strong>{{newCtc}}</strong> per annum.</p>
      <p>We congratulate you on this milestone and look forward to your continued leadership.</p>
      <br/><p>Sincerely,<br/><strong>{{companyName}}</strong></p>
    `,
  },
  resignationAcceptance: {
    title: 'Resignation Acceptance Letter',
    bodyContent: `
      <h2>Acceptance of Resignation</h2>
      <p>Date: {{currentDate}}</p>
      <p>Dear <strong>{{employeeName}}</strong>,</p>
      <p>This letter is to formally acknowledge and accept your resignation dated <strong>{{resignationDate}}</strong> from the position of <strong>{{designation}}</strong> at <strong>{{companyName}}</strong>.</p>
      <p>Your final working day with the organization will be <strong>{{lastWorkingDate}}</strong>. Please complete the handover and asset clearance process prior to your exit.</p>
      <br/><p>Warm regards,<br/><strong>{{companyName}}</strong></p>
    `,
  },
  relievingLetter: {
    title: 'Standard Relieving Letter',
    bodyContent: `
      <h2>Relieving Letter</h2>
      <p>Date: {{currentDate}}</p>
      <p>To Whom It May Concern,</p>
      <p>This is to certify that <strong>{{employeeName}}</strong> (Employee ID: {{employeeCode}}) was employed with <strong>{{companyName}}</strong> as <strong>{{designation}}</strong> in the <strong>{{department}}</strong> department from <strong>{{joiningDate}}</strong> to <strong>{{lastWorkingDate}}</strong>.</p>
      <p>The employee is formally relieved of all duties and responsibilities at the close of business on <strong>{{lastWorkingDate}}</strong>. We confirm that all organizational dues and assets have been settled.</p>
      <br/><p>Sincerely,<br/><strong>{{companyName}}</strong><br/>{{companyAddress}}</p>
    `,
  },
  experienceLetter: {
    title: 'Standard Experience Certificate',
    bodyContent: `
      <h2>Experience Certificate</h2>
      <p>Date: {{currentDate}}</p>
      <p>To Whom It May Concern,</p>
      <p>This is to certify that <strong>{{employeeName}}</strong> (Employee Code: {{employeeCode}}) has served at <strong>{{companyName}}</strong> from <strong>{{joiningDate}}</strong> to <strong>{{lastWorkingDate}}</strong>, completing their tenure as <strong>{{designation}}</strong>.</p>
      <p>During their tenure, we found them to be diligent, professional, and dedicated to their responsibilities. We wish them success in all future endeavors.</p>
      <br/><p>Sincerely,<br/><strong>{{companyName}}</strong><br/>{{companyAddress}}</p>
    `,
  },
  warningLetter: {
    title: 'Standard Disciplinary Warning Letter',
    bodyContent: `
      <h2>Formal Disciplinary Notice</h2>
      <p>Date: {{currentDate}}</p>
      <p>Dear <strong>{{employeeName}}</strong> ({{designation}} - {{department}}),</p>
      <p>This letter serves as a formal warning regarding the following matter: <strong>{{incidentDetails}}</strong>.</p>
      <p>You are requested to adhere to the required corrective measures: <strong>{{correctiveAction}}</strong> starting immediately on <strong>{{issueDate}}</strong>.</p>
      <p>Failure to demonstrate satisfactory improvement may lead to further disciplinary actions in accordance with company policy.</p>
      <br/><p>Issued by,<br/><strong>{{companyName}} Human Resources</strong></p>
    `,
  },
};