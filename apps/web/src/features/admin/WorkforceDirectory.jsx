import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../lib/apiClient.js';
import axios from 'axios';

export default function WorkforceDirectory() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [createdCredentials, setCreatedCredentials] = useState(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  // Search & Filter States
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [viewMode, setViewMode] = useState('table');

  // Metrics State
  const [metrics, setMetrics] = useState({
    total: 0,
    fullTime: 0,
    contract: 0,
    unassigned: 0,
    probation: 0,
  });

  // Pagination State
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    employeeCode: '',
    cnic: '',
    departmentId: '',
    designation: '',
    status: 'ACTIVE',
    joiningDate: new Date().toISOString().slice(0, 10),
  });

  // Bulk Import States
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importProgressText, setImportProgressText] = useState('');
  const [importSummary, setImportSummary] = useState(null);
  const [importError, setImportError] = useState('');

  // 1. Fetch Departments
  useEffect(() => {
    const fetchDepts = async () => {
      try {
        const res = await apiClient.get('/departments');
        const list = res.data?.data || [];
        setDepartments(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error('Failed to load departments:', err);
      }
    };
    fetchDepts();
  }, []);

  // 2. Fetch Directory Records
  const loadDirectoryData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('limit', 10);

      if (search.trim()) params.append('search', search.trim());
      if (selectedDept && selectedDept.trim() !== '') {
        params.append('department', selectedDept.trim());
      }
      if (selectedStatus && selectedStatus !== 'ALL') {
        params.append('status', selectedStatus);
      }

      const res = await apiClient.get(`/employees?${params.toString()}`);
      const payload = res.data?.data;

      let list = [];
      let total = 0;

      if (payload?.employees && Array.isArray(payload.employees)) {
        list = payload.employees;
        total = payload.total || list.length;
        setTotalPages(Math.ceil(total / (payload.limit || 10)) || 1);
      } else if (payload?.docs && Array.isArray(payload.docs)) {
        list = payload.docs;
        total = payload.totalDocs || list.length;
        setTotalPages(payload.totalPages || 1);
      } else if (Array.isArray(payload)) {
        list = payload;
        total = list.length;
        setTotalPages(1);
      }

      setEmployees(list);
      setTotalRecords(total);

      const unassigned = list.filter((e) => {
        const dObj =
          typeof e.department === 'object' && e.department !== null
            ? e.department
            : departments.find((d) => String(d._id) === String(e.department || e.departmentId));
        return !dObj || dObj.name?.toUpperCase().includes('UNASSIGNED');
      }).length;

      const probation = list.filter(
        (e) => String(e.employmentStatus || e.status).toUpperCase() === 'PROBATION'
      ).length;

      const active = list.filter(
        (e) => String(e.employmentStatus || e.status).toUpperCase() === 'ACTIVE'
      ).length;

      setMetrics({
        total: total,
        fullTime: active,
        contract: Math.max(0, total - (active + probation)),
        unassigned,
        probation,
      });
    } catch (err) {
      console.error('Error fetching employee registry:', err);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedDept, selectedStatus, departments]);

  useEffect(() => {
    loadDirectoryData();
  }, [loadDirectoryData]);

  // 3. Download CSV Template
  const handleDownloadTemplate = async () => {
    try {
      const res = await apiClient.get('/employees/bulk-import/template', {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'workforce_bulk_import_template.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      // Client-side fallback if backend template endpoint is not hit
      const headers = 'firstName,lastName,email,cnic,employeeId,department,designation,dateOfJoining,employmentStatus,phone,address\n';
      const sample = 'Ali,Khan,ali.khan@cloudlogic.com,35201-1234567-1,EMP-2026-050,Marketing,Associate Consultant,2026-02-01,ACTIVE,03001234567,Lahore\n';
      const blob = new Blob([headers + sample], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'workforce_bulk_import_template.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  };

  // 4. Handle Bulk Import Submit & Background Polling
  // 4. Direct AWS S3 Upload & Batch Trigger
const handleImportSubmit = async (e) => {
  e.preventDefault();
  if (!importFile) {
    setImportError('Please attach a valid .csv file.');
    return;
  }

  try {
    setImportLoading(true);
    setImportError('');
    setImportSummary(null);

    // Stage 1: Backend se S3 Presigned URL lein
    setImportProgressText('Authorizing AWS S3 storage gateway...');
    const presignedRes = await apiClient.post('/employees/bulk-import/presigned-url', {
      fileName: importFile.name,
      fileType: importFile.type || 'text/csv',
    });

    const { uploadUrl, s3Key } = presignedRes.data?.data;

    // Stage 2: Direct browser-to-S3 upload (Bypass Node Server)
    setImportProgressText('Streaming CSV directly to AWS S3 bucket...');
    await axios.put(uploadUrl, importFile, {
      headers: {
        'Content-Type': importFile.type || 'text/csv',
      },
    });

    // Stage 3: Backend ko S3 Key bhej kar ingestion start karwayein
    setImportProgressText('Validating and compiling enterprise records...');
    const processRes = await apiClient.post('/employees/bulk-import', { s3Key });
    const data = processRes.data?.data;

    // Stage 4: Background polling or sync completion
    if (data?.isBackgroundJob && data?.jobId) {
      setImportProgressText(`Batch queued (${data.totalRows} records). Waiting for worker...`);
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await apiClient.get(`/employees/bulk-import/jobs/${data.jobId}`);
          const jobData = statusRes.data?.data;

          if (jobData?.status === 'COMPLETED') {
            clearInterval(pollInterval);
            setImportLoading(false);
            setImportSummary(jobData.result?.summary || { message: 'Background import finished.' });
            loadDirectoryData();
          } else if (jobData?.status === 'FAILED') {
            clearInterval(pollInterval);
            setImportLoading(false);
            setImportError(jobData.failedReason || 'Queue processing failed.');
          } else {
            setImportProgressText(`Worker executing batch (${jobData?.progress || 0}%)...`);
          }
        } catch {
          clearInterval(pollInterval);
          setImportLoading(false);
          setImportError('Failed to poll background worker.');
        }
      }, 2000);
    } else {
      setImportLoading(false);
      setImportSummary(data?.summary || { totalRows: 0, successfulCount: 0, failedCount: 0 });
      loadDirectoryData();
    }
  } catch (err) {
    console.error('S3 Bulk import error:', err);
    setImportLoading(false);
    setImportError(err.response?.data?.message || 'Error occurred while streaming file to AWS S3.');
  }
};

  // 5. Add Single Employee Submit
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setModalError('');

    if (
      !formData.firstName.trim() ||
      !formData.lastName.trim() ||
      !formData.email.trim() ||
      !formData.employeeCode.trim() ||
      !formData.cnic.trim() ||
      !formData.departmentId ||
      !formData.designation.trim()
    ) {
      setModalError('Please fill all required fields and select a Department.');
      return;
    }

    try {
      setModalLoading(true);

      const payload = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim().toLowerCase(),
        cnic: formData.cnic.trim(),
        employeeId: formData.employeeCode.trim().toUpperCase(),
        department: formData.departmentId,
        departmentId: formData.departmentId,
        designation: formData.designation.trim(),
        dateOfJoining: formData.joiningDate || new Date().toISOString().slice(0, 10),
        employmentStatus: formData.status || 'PROBATION',
      };

      const res = await apiClient.post('/employees', payload);
      const authInfo = res.data?.data?.authAccount;

      setShowAddModal(false);

      if (authInfo?.tempPassword) {
        setCreatedCredentials({
          name: `${formData.firstName} ${formData.lastName}`,
          email: authInfo.email || formData.email,
          employeeId: formData.employeeCode.toUpperCase(),
          tempPassword: authInfo.tempPassword,
        });
      }

      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        employeeCode: '',
        cnic: '',
        departmentId: '',
        designation: '',
        status: 'ACTIVE',
        joiningDate: new Date().toISOString().slice(0, 10),
      });

      loadDirectoryData();
    } catch (err) {
      console.error('Registration error:', err);
      setModalError(err.response?.data?.message || 'Failed to register employee.');
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto select-none font-sans text-[#1D2530] pb-12">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 px-6 rounded-lg border border-[#E3DED4] shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-[#8C5D17] tracking-wider uppercase font-semibold">
              HR-OPS-REGISTRY // 2026 • {metrics.total} ACTIVE PROFILES
            </span>
          </div>
          <h1 className="text-lg font-bold text-[#111C2E] mt-0.5">
            Workforce & Employee Directory
          </h1>
          <p className="text-[11px] text-[#69788A]">
            Manage organizational profiles, department allocations, reporting lines, and compliance records.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Functional Bulk Import Button */}
          <button
            onClick={() => {
              setImportError('');
              setImportSummary(null);
              setImportFile(null);
              setShowImportModal(true);
            }}
            className="px-3.5 py-1.5 bg-[#FAF8F5] hover:bg-[#F2EFE9] border border-[#D5CEC2] rounded text-xs font-mono font-medium text-[#111C2E] flex items-center gap-2 cursor-pointer transition-all"
          >
            <span>📥</span>
            <span>Bulk Import (CSV)</span>
          </button>
          
          {/* Add Single Employee */}
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-1.5 bg-[#8C5D17] hover:bg-[#784F14] text-white rounded text-xs font-mono font-semibold flex items-center gap-2 cursor-pointer shadow-xs transition-all"
          >
            <span>👤+</span>
            <span>+ Add Single Employee</span>
          </button>
        </div>
      </div>

      {/* Top 3 Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 px-5 rounded-lg border border-[#E3DED4] shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[9.5px] font-mono font-bold text-[#728294] uppercase tracking-wider block">
              TOTAL ACTIVE WORKFORCE
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-serif font-bold text-[#111C2E]">
                {metrics.total}
              </span>
              <span className="text-[10px] font-mono text-[#1E7E34] font-semibold">
                Live CloudLogic Sync
              </span>
            </div>
            <div className="text-[10px] font-mono text-[#728294]">
              {metrics.fullTime} Full-Time • {metrics.contract} Contract Personnel
            </div>
          </div>
          <div className="w-9 h-9 rounded bg-[#FAF8F5] border border-[#E3DED4] flex items-center justify-center text-[#728294] text-sm">
            👥
          </div>
        </div>

        <div className="bg-white p-4 px-5 rounded-lg border border-[#E3DED4] shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[9.5px] font-mono font-bold text-[#728294] uppercase tracking-wider block">
              UNASSIGNED DEPT POOL
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-serif font-bold text-[#8C5D17]">
                {String(metrics.unassigned).padStart(2, '0')}
              </span>
              {metrics.unassigned > 0 ? (
                <span className="px-1.5 py-0.5 bg-[#FAF3E8] text-[#8C5D17] border border-[#E8D4B5] rounded text-[9.5px] font-mono font-bold">
                  Action Required
                </span>
              ) : (
                <span className="px-1.5 py-0.5 bg-[#EBF7EE] text-[#1E7E34] border border-[#C8E6C9] rounded text-[9.5px] font-mono font-bold">
                  Fully Allocated
                </span>
              )}
            </div>
            <div className="text-[10px] font-mono text-[#728294]">
              Pending final managerial allocation
            </div>
          </div>
          <div className="w-9 h-9 rounded bg-[#FAF8F5] border border-[#E3DED4] flex items-center justify-center text-[#8C5D17] text-sm">
            👤!
          </div>
        </div>

        <div className="bg-white p-4 px-5 rounded-lg border border-[#E3DED4] shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[9.5px] font-mono font-bold text-[#728294] uppercase tracking-wider block">
              PROBATIONARY STAFF
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-serif font-bold text-[#111C2E]">
                {metrics.probation}
              </span>
              <span className="text-[10px] font-mono text-[#546274]">
                Review Pending
              </span>
            </div>
            <div className="text-[10px] font-mono text-[#728294]">
              Awaiting standard evaluation
            </div>
          </div>
          <div className="w-9 h-9 rounded bg-[#FAF8F5] border border-[#E3DED4] flex items-center justify-center text-[#728294] text-sm">
            📄
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-3 rounded-lg border border-[#E3DED4] shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative min-w-[320px] flex-1">
            <span className="absolute left-3 top-2 text-[#8C9BAE] text-xs">
              🔍
            </span>
            <input
              type="text"
              placeholder="Search by name, EMP-ID, or CNIC..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded pl-8 pr-3 py-1.5 text-xs text-[#1D2530] placeholder-[#8C9BAE] outline-none focus:border-[#8C5D17]"
            />
          </div>

          <select
            value={selectedDept}
            onChange={(e) => {
              setSelectedDept(e.target.value);
              setPage(1);
            }}
            className="bg-[#FAF8F5] border border-[#D5CEC2] rounded px-3 py-1.5 text-xs text-[#1D2530] outline-none cursor-pointer"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name} {d.code ? `(${d.code})` : ''}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            className="bg-[#FAF8F5] border border-[#D5CEC2] rounded px-3 py-1.5 text-xs text-[#1D2530] outline-none cursor-pointer"
          >
            <option value="ALL">Employment Status: All</option>
            <option value="ACTIVE">Active</option>
            <option value="PROBATION">Probation</option>
            <option value="ON_NOTICE">On Notice</option>
            <option value="TERMINATED">Terminated</option>
          </select>
        </div>

        <div className="flex items-center gap-1 bg-[#FAF8F5] p-1 rounded border border-[#E3DED4] text-xs font-mono">
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1 rounded flex items-center gap-1.5 cursor-pointer transition-all ${
              viewMode === 'table'
                ? 'bg-white font-bold text-[#111C2E] shadow-2xs'
                : 'text-[#728294] hover:text-[#111C2E]'
            }`}
          >
            <span>▤</span>
            <span>Ledger Table</span>
          </button>
          <button
            onClick={() => setViewMode('tree')}
            className={`px-3 py-1 rounded flex items-center gap-1.5 cursor-pointer transition-all ${
              viewMode === 'tree'
                ? 'bg-white font-bold text-[#111C2E] shadow-2xs'
                : 'text-[#728294] hover:text-[#111C2E]'
            }`}
          >
            <span>⑂</span>
            <span>Org Tree</span>
          </button>
        </div>
      </div>

      {/* Directory Table View */}
      <div className="bg-white rounded-lg border border-[#E3DED4] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FAF8F5] border-b border-[#E3DED4] text-[9.5px] font-mono uppercase tracking-wider text-[#728294]">
                <th className="py-3 px-5">EMPLOYEE DETAILS</th>
                <th className="py-3 px-4">IDENTIFICATION (CNIC)</th>
                <th className="py-3 px-4">DEPARTMENT & DESIGNATION</th>
                <th className="py-3 px-4">DIRECT MANAGER</th>
                <th className="py-3 px-4">JOINING DATE</th>
                <th className="py-3 px-4 text-center">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F4F1EA] text-xs">
              {loading ? (
                <tr>
                  <td
                    colSpan="6"
                    className="py-10 text-center font-mono text-xs text-[#728294]"
                  >
                    Hydrating workforce ledger records directly from Atlas...
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td
                    colSpan="6"
                    className="py-10 text-center font-mono text-xs text-[#728294]"
                  >
                    No personnel records currently registered in this company. Click "+ Add Single Employee" or "Bulk Import (CSV)" to onboard.
                  </td>
                </tr>
              ) : (
                employees.map((emp) => {
                  const status = String(emp.employmentStatus || emp.status || 'ACTIVE').toUpperCase();
                  
                  const deptObj =
                    typeof emp.department === 'object' && emp.department !== null
                      ? emp.department
                      : departments.find(
                          (d) => String(d._id) === String(emp.department || emp.departmentId)
                        );

                  const deptName = deptObj?.name || 'UNASSIGNED POOL';
                  const isUnassigned = !deptObj || deptName.toUpperCase().includes('UNASSIGNED');

                  return (
                    <tr
                      key={emp._id}
                      className="hover:bg-[#FAF8F5]/80 transition-colors"
                    >
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#20314C] text-white flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden border border-[#D5CEC2]">
                            {emp.avatar ? (
                              <img
                                src={emp.avatar}
                                alt={emp.firstName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              emp.firstName?.charAt(0) || 'E'
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-[#111C2E]">
                              {emp.firstName} {emp.lastName || ''}
                            </div>
                            <div className="text-[10px] font-mono text-[#728294]">
                              <span className="font-semibold text-[#8C5D17]">
                                {emp.employeeId || emp.employeeCode || 'PENDING-ID'}
                              </span>{' '}
                              • {emp.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[11px] text-[#546274]">
                        {emp.cnic || emp.nationalId || 'N/A'}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <span
                            className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase ${
                              isUnassigned
                                ? 'bg-[#FAF3E8] text-[#8C5D17] border border-[#E8D4B5]'
                                : 'bg-[#FAF8F5] text-[#546274] border border-[#E3DED4]'
                            }`}
                          >
                            {deptName}
                          </span>
                          <div className="text-[11px] font-medium text-[#111C2E]">
                            {emp.designation || 'Staff Associate'}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-[#E5E0D6] flex items-center justify-center text-[9px] font-bold text-[#546274]">
                            {emp.managerId?.firstName
                              ? emp.managerId.firstName.charAt(0)
                              : emp.manager?.firstName
                              ? emp.manager.firstName.charAt(0)
                              : '—'}
                          </div>
                          <span className="text-[11px] text-[#546274]">
                            {emp.managerId?.firstName
                              ? `${emp.managerId.firstName} ${emp.managerId.lastName || ''}`
                              : emp.manager?.firstName
                              ? `${emp.manager.firstName} ${emp.manager.lastName || ''}`
                              : 'Unassigned'}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[11px] text-[#546274]">
                        {emp.dateOfJoining || emp.joiningDate || emp.createdAt
                          ? String(emp.dateOfJoining || emp.joiningDate || emp.createdAt).slice(0, 10)
                          : 'N/A'}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium ${
                            status === 'ACTIVE'
                              ? 'bg-[#EBF7EE] text-[#1E7E34]'
                              : status === 'PROBATION'
                              ? 'bg-[#FFF4E5] text-[#C48628]'
                              : 'bg-[#F2F4F7] text-[#546274]'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              status === 'ACTIVE'
                                ? 'bg-[#1E7E34]'
                                : status === 'PROBATION'
                                ? 'bg-[#C48628]'
                                : 'bg-[#546274]'
                            }`}
                          />
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Real Numeric Pagination */}
        <div className="p-3.5 bg-white border-t border-[#E3DED4] flex items-center justify-between text-xs font-mono text-[#728294]">
          <span>
            Showing {employees.length > 0 ? (page - 1) * 10 + 1 : 0} to{' '}
            {Math.min(page * 10, totalRecords)} of {totalRecords} total records
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-2.5 py-1 bg-white border border-[#D5CEC2] rounded text-[11px] text-[#546274] disabled:opacity-40 cursor-pointer"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .slice(0, 5)
              .map((pNum) => (
                <button
                  key={pNum}
                  onClick={() => setPage(pNum)}
                  className={`w-6 h-6 rounded flex items-center justify-center text-[11px] font-bold cursor-pointer transition-all ${
                    page === pNum
                      ? 'bg-[#111C2E] text-white'
                      : 'bg-white border border-[#D5CEC2] text-[#546274] hover:bg-[#FAF8F5]'
                  }`}
                >
                  {pNum}
                </button>
              ))}
            {totalPages > 5 && <span className="px-1 text-[#8C9BAE]">...</span>}
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-2.5 py-1 bg-white border border-[#D5CEC2] rounded text-[11px] text-[#546274] disabled:opacity-40 cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Modal 1: + Add Single Employee */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-lg border border-[#E3DED4] shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-4 px-5 border-b border-[#E3DED4] flex items-center justify-between bg-[#FAF8F5]">
              <h2 className="text-sm font-bold text-[#111C2E]">
                Register New Enterprise Personnel
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-xs text-[#728294] hover:text-[#111C2E] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-5 space-y-4 text-xs">
              {modalError && (
                <div className="p-2.5 bg-[#FDEEEB] border border-[#F5C2BA] text-[#B83E28] rounded font-mono text-[11px]">
                  {modalError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-[#111C2E] block">First Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded px-2.5 py-1.5 outline-none focus:border-[#8C5D17]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-[#111C2E] block">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded px-2.5 py-1.5 outline-none focus:border-[#8C5D17]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-[#111C2E] block">Official Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded px-2.5 py-1.5 outline-none focus:border-[#8C5D17]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-[#111C2E] block">EMP-ID Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="EMP-2026-001"
                    value={formData.employeeCode}
                    onChange={(e) => setFormData({ ...formData, employeeCode: e.target.value })}
                    className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded px-2.5 py-1.5 uppercase outline-none focus:border-[#8C5D17]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-[#111C2E] block">CNIC / ID Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="35201-0000000-0"
                    value={formData.cnic}
                    onChange={(e) => setFormData({ ...formData, cnic: e.target.value })}
                    className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded px-2.5 py-1.5 outline-none focus:border-[#8C5D17]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-[#111C2E] block">Designation *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Operations Manager"
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded px-2.5 py-1.5 outline-none focus:border-[#8C5D17]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-[#111C2E] block">Department *</label>
                  <select
                    required
                    value={formData.departmentId}
                    onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                    className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded px-2.5 py-1.5 outline-none cursor-pointer"
                  >
                    <option value="">Select Department</option>
                    {departments.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name} {d.code ? `(${d.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-[#111C2E] block">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded px-2.5 py-1.5 outline-none cursor-pointer"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="PROBATION">PROBATION</option>
                    <option value="ON_NOTICE">ON NOTICE</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-[#E3DED4] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 bg-[#FAF8F5] border border-[#D5CEC2] rounded text-xs text-[#546274] hover:bg-[#F2EFE9] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-4 py-1.5 bg-[#8C5D17] hover:bg-[#784F14] text-white rounded text-xs font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {modalLoading ? 'Registering...' : 'Register Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Bulk CSV Import with Progress & Reporting */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-lg border border-[#E3DED4] shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-4 px-5 border-b border-[#E3DED4] bg-[#FAF8F5] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">📄</span>
                <h2 className="text-sm font-bold text-[#111C2E]">Bulk Personnel Import (CSV)</h2>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-xs text-[#728294] hover:text-[#111C2E] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs font-sans">
              {/* Template Download Prompt */}
              <div className="flex items-center justify-between bg-[#FAF8F5] p-3 rounded border border-[#EAE6DD]">
                <div>
                  <div className="font-semibold text-[#111C2E]">CSV Template & Headers</div>
                  <div className="text-[10px] text-[#728294] font-mono">Download standard column layout</div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="px-3 py-1.5 bg-white border border-[#D5CEC2] hover:bg-[#F4F1EA] text-[#8C5D17] font-mono font-bold rounded text-[11px] cursor-pointer shadow-2xs"
                >
                  ⬇ Download Template (.csv)
                </button>
              </div>

              {/* Error Message Display */}
              {importError && (
                <div className="p-2.5 bg-[#FDEEEB] border border-[#F5C2BA] text-[#B83E28] rounded font-mono text-[11px]">
                  {importError}
                </div>
              )}

              {/* Success / Granular Import Summary */}
              {importSummary && (
                <div className="p-3 bg-[#EBF7EE] border border-[#C8E6C9] rounded space-y-1.5 font-mono text-[11px]">
                  <div className="font-bold text-[#1E7E34] flex items-center gap-1.5">
                    <span>✓</span>
                    <span>Batch Execution Completed</span>
                  </div>
                  <div className="text-[#325239] flex gap-4 pt-1">
                    <span>Total: <strong>{importSummary.totalRows || 0}</strong></span>
                    <span>Success: <strong>{importSummary.successfulCount || 0}</strong></span>
                    <span className={importSummary.failedCount > 0 ? 'text-[#B83E28]' : ''}>
                      Failed: <strong>{importSummary.failedCount || 0}</strong>
                    </span>
                  </div>
                </div>
              )}

              {/* Upload Form */}
              <form onSubmit={handleImportSubmit} className="space-y-4">
                <div className="border-2 border-dashed border-[#D5CEC2] hover:border-[#8C5D17] rounded-lg p-6 text-center space-y-2 bg-[#FAF8F5] transition-colors">
                  <input
                    type="file"
                    accept=".csv"
                    id="csvFileInput"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setImportFile(file);
                        setImportError('');
                        setImportSummary(null);
                      }
                    }}
                  />
                  <label htmlFor="csvFileInput" className="cursor-pointer block space-y-2">
                    <div className="text-3xl">📂</div>
                    <div className="text-xs font-semibold text-[#111C2E]">
                      {importFile ? importFile.name : 'Click to select CSV spreadsheet'}
                    </div>
                    <div className="text-[10px] text-[#728294] font-mono">
                      {importFile ? `${(importFile.size / 1024).toFixed(1)} KB` : 'Threshold: Synchronous (≤100), BullMQ Queue (>100)'}
                    </div>
                  </label>
                </div>

                {importLoading && (
                  <div className="text-center font-mono text-[11px] text-[#8C5D17] animate-pulse">
                    ⏳ {importProgressText}
                  </div>
                )}

                <div className="pt-2 border-t border-[#E3DED4] flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowImportModal(false)}
                    className="px-3.5 py-1.5 bg-[#FAF8F5] border border-[#D5CEC2] rounded text-xs text-[#546274] hover:bg-[#F2EFE9] cursor-pointer font-mono"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={importLoading || !importFile}
                    className="px-4 py-1.5 bg-[#8C5D17] hover:bg-[#784F14] text-white rounded text-xs font-semibold disabled:opacity-50 cursor-pointer font-mono shadow-xs"
                  >
                    {importLoading ? 'Processing Batch...' : 'Upload & Process Batch'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Employee Onboarding Credentials Card */}
      {createdCredentials && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-lg border border-[#E3DED4] shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 px-5 border-b border-[#E3DED4] bg-[#FAF8F5] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#1E7E34] animate-pulse" />
                <h2 className="text-sm font-bold text-[#111C2E]">
                  Employee Onboarded Successfully
                </h2>
              </div>
              <button
                onClick={() => {
                  setCreatedCredentials(null);
                  setCopied(false);
                }}
                className="text-xs text-[#728294] hover:text-[#111C2E] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs font-sans">
              <p className="text-[#546274] text-[11.5px] leading-relaxed">
                The employee record and login account have been initialized. Please share these temporary credentials with <strong className="text-[#111C2E]">{createdCredentials.name}</strong>.
              </p>

              <div className="bg-[#FAF8F5] border border-[#E3DED4] rounded-md p-3.5 space-y-2.5">
                <div className="flex justify-between items-center text-[11px] pb-2 border-b border-[#EAE6DD]">
                  <span className="text-[#728294] font-mono">PERSONNEL ID</span>
                  <span className="font-mono font-bold text-[#8C5D17]">
                    {createdCredentials.employeeId}
                  </span>
                </div>

                <div className="flex justify-between items-center text-[11px] pb-2 border-b border-[#EAE6DD]">
                  <span className="text-[#728294] font-mono">LOGIN EMAIL</span>
                  <span className="font-mono font-semibold text-[#111C2E]">
                    {createdCredentials.email}
                  </span>
                </div>

                <div className="flex justify-between items-center text-[11px] pt-0.5">
                  <span className="text-[#728294] font-mono">TEMPORARY PASSWORD</span>
                  <span className="font-mono font-bold text-[#111C2E] bg-white px-2 py-1 border border-[#D5CEC2] rounded tracking-wider">
                    {createdCredentials.tempPassword}
                  </span>
                </div>
              </div>

              <div className="p-2.5 bg-[#FFFDF7] border border-[#ECD9B2] rounded text-[10.5px] text-[#6F5724] space-y-0.5 font-mono">
                <div className="font-bold flex items-center gap-1">
                  <span>⚠️</span>
                  <span>First-Time Login Protocol:</span>
                </div>
                <p className="leading-snug">
                  This password will expire after the first login. The employee will be forced to configure their permanent passphrase.
                </p>
              </div>

              <div className="pt-2 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    const textToCopy = `Portal Login Credentials:\nEmail: ${createdCredentials.email}\nTemp Password: ${createdCredentials.tempPassword}\nEMP ID: ${createdCredentials.employeeId}`;
                    navigator.clipboard.writeText(textToCopy);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 3000);
                  }}
                  className="flex-1 py-2 bg-[#8C5D17] hover:bg-[#784F14] text-white rounded text-xs font-mono font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all"
                >
                  <span>{copied ? '✓' : '📋'}</span>
                  <span>{copied ? 'Credentials Copied!' : 'Copy Full Login Details'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCreatedCredentials(null);
                    setCopied(false);
                  }}
                  className="px-4 py-2 bg-white hover:bg-[#FAF8F5] border border-[#D5CEC2] rounded text-xs text-[#546274] font-mono cursor-pointer transition-all"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}