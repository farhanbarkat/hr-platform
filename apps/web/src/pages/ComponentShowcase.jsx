import React, { useState } from 'react';
import {
  Button,
  Input,
  Badge,
  Card,
  NotchedStatCard,
  ListItemCard,
  Modal,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@repo/ui';

export default function ComponentShowcase() {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSize, setModalSize] = useState('sm');
  const [isIrreversible, setIsIrreversible] = useState(false);

  return (
    <div className="min-h-screen bg-[#F6F5F1] p-8 max-w-5xl mx-auto space-y-12">
      <div>
        <h1 className="text-3xl font-bold text-[#16233B] font-sans">
          Design System Component Library (FE-002)
        </h1>
        <p className="text-sm text-[#5B6B79] mt-1 font-sans">
          Implemented strictly from Frontend Specification Document Part A tokens, typography, and component rules.
        </p>
      </div>

      {/* 1. Buttons */}
      <Card className="space-y-4">
        <h2 className="text-base font-semibold text-[#16233B]">1. Buttons (Section A.5)</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Primary Brass</Button>
          <Button variant="secondary">Secondary Ledger</Button>
          <Button variant="destructive">Destructive Red</Button>
          <Button variant="ghost">Ghost Slate</Button>
          <Button variant="primary" isLoading>Processing</Button>
          <Button variant="primary" disabled>Disabled State</Button>
        </div>
      </Card>

      {/* 2. Semantic Badges */}
      <Card className="space-y-4">
        <h2 className="text-base font-semibold text-[#16233B]">2. Semantic Status Badges (Section A.1)</h2>
        <div className="flex flex-wrap gap-3">
          <Badge variant="success">Approved / Present</Badge>
          <Badge variant="warning">Pending Review / Grace Period</Badge>
          <Badge variant="error">Rejected / Overspending</Badge>
          <Badge variant="info">In Progress / Info</Badge>
        </div>
      </Card>

      {/* 3. Signature Notched Stat Cards */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-[#16233B]">3. Notched Stat Cards (Section A.4)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <NotchedStatCard
            title="August 2026 Payroll"
            value="PKR 450,000"
            subtitle="Calculated & Approved"
            trend="+12.5% MoM"
          />
          <NotchedStatCard
            title="Total Headcount"
            value="142"
            subtitle="Present Today: 138"
            trend="97.2% Shift Compliance"
          />
          <NotchedStatCard
            title="Net Profit Margin"
            value="56.25%"
            subtitle="Threshold: 60.00%"
            trend="Warning Alert Triggered"
          />
        </div>
      </div>

      {/* 4. Form Inputs & Numeric Mono */}
      <Card className="space-y-4">
        <h2 className="text-base font-semibold text-[#16233B]">4. Inputs & Tabular Mono Figures (Section A.2, A.5)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Employee Full Name" placeholder="e.g. Farhan Barkat" />
          <Input
            label="Monthly Base Salary (IBM Plex Mono)"
            placeholder="150,000.00"
            defaultValue="150000"
            isNumeric
          />
          <Input
            label="Work Email"
            error="Email domain must match registered company domain"
            defaultValue="user@external-domain.com"
          />
          <Input
            label="Department Assignment"
            as="select"
            defaultValue="ENG"
          >
            <option value="ENG">Engineering (ENG)</option>
            <option value="HR">Human Resources (HR)</option>
            <option value="FIN">Finance (FIN)</option>
          </Input>
        </div>
      </Card>

      {/* 5. List Items with Semantic Status Bar */}
      <Card className="space-y-4">
        <h2 className="text-base font-semibold text-[#16233B]">5. List-Item Cards with 3px Left Status Bar</h2>
        <div className="space-y-3">
          <ListItemCard status="warning">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm">Pending Manager Leave Approval — Annual Leave (3 Days)</span>
              <Badge variant="warning">Pending</Badge>
            </div>
          </ListItemCard>
          <ListItemCard status="success">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm">August 2026 Payslip Generation Complete</span>
              <Badge variant="success">Completed</Badge>
            </div>
          </ListItemCard>
          <ListItemCard status="error">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm">Expense Exceeds Monthly Threshold</span>
              <Badge variant="error">Critical</Badge>
            </div>
          </ListItemCard>
        </div>
      </Card>

      {/* 6. Dense Tabular Ledger */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-[#16233B]">6. Dense Ledger Table (Section A.2, A.5)</h2>
        <Table>
          <TableHead>
            <tr>
              <TableCell className="font-bold">Period</TableCell>
              <TableCell className="font-bold">Gross Inflow</TableCell>
              <TableCell className="font-bold">Total Outflow</TableCell>
              <TableCell className="font-bold text-right">Net Profit</TableCell>
              <TableCell className="font-bold text-center">Audit Status</TableCell>
            </tr>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>2026-08</TableCell>
              <TableCell isMono>PKR 800,000</TableCell>
              <TableCell isMono>PKR 350,000</TableCell>
              <TableCell isMono isRight className="text-[#2E7D5B] font-bold">PKR +450,000</TableCell>
              <TableCell className="text-center"><Badge variant="success">Balanced</Badge></TableCell>
            </TableRow>
            <TableRow>
              <TableCell>2026-07</TableCell>
              <TableCell isMono>PKR 750,000</TableCell>
              <TableCell isMono>PKR 340,000</TableCell>
              <TableCell isMono isRight className="text-[#2E7D5B] font-bold">PKR +410,000</TableCell>
              <TableCell className="text-center"><Badge variant="success">Balanced</Badge></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* 7. Modals Controls */}
      <Card className="space-y-4">
        <h2 className="text-base font-semibold text-[#16233B]">7. Modal Safeguards (Section A.5)</h2>
        <div className="flex gap-4">
          <Button
            variant="secondary"
            onClick={() => {
              setModalSize('sm');
              setIsIrreversible(false);
              setModalOpen(true);
            }}
          >
            Open Standard Modal (480px)
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              setModalSize('sm');
              setIsIrreversible(true);
              setModalOpen(true);
            }}
          >
            Open Irreversible Modal (No Backdrop Close)
          </Button>
        </div>
      </Card>

      {/* Modal Instance */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        size={modalSize}
        isIrreversible={isIrreversible}
        title={isIrreversible ? 'Confirm Irreversible Action' : 'System Information'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={isIrreversible ? 'destructive' : 'primary'}
              onClick={() => setModalOpen(false)}
            >
              {isIrreversible ? 'Execute & Lock' : 'Confirm'}
            </Button>
          </>
        }
      >
        <p>
          {isIrreversible
            ? 'This action cannot be undone. Approved payroll runs will be frozen and immutable payslip records generated for all eligible employees.'
            : 'Review standard operational records before continuing to the next step.'}
        </p>
      </Modal>
    </div>
  );
}