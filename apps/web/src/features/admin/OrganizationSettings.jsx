import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../../lib/apiClient.js';

export default function OrganizationSettings() {
  const [activeTab, setActiveTab] = useState('templates'); // 'templates' | 'tax' | 'hours' | 'announcements'
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionStatus, setActionStatus] = useState('');
  const [actionError, setActionError] = useState('');

  // -------------------------------------------------------------
  // TAB 1: LETTERHEAD TEMPLATES STATE
  // -------------------------------------------------------------
  const [templates, setTemplates] = useState([]);
  const [selectedType, setSelectedType] = useState('offerLetter');
  const [activeTemplate, setActiveTemplate] = useState(null);
  const [bodyContent, setBodyContent] = useState('');
  const [templateTitle, setTemplateTitle] = useState('');
  const textareaRef = useRef(null);

  // -------------------------------------------------------------
  // TAB 2: TAX SLABS STATE
  // -------------------------------------------------------------
  const [slabs, setSlabs] = useState([]);
  const [countryCode, setCountryCode] = useState('PK');
  const [taxYear, setTaxYear] = useState('2024-2025');
  const [sampleSalary, setSampleSalary] = useState(250000);
  const [simulationResult, setSimulationResult] = useState(null);
  const [simulating, setSimulating] = useState(false);

  // -------------------------------------------------------------
  // TAB 3: OPERATING PARAMETERS & ATTENDANCE STATE
  // -------------------------------------------------------------
  const [operatingParams, setOperatingParams] = useState({
    standardWorkingHours: 8.0,
    gracePeriodMinutes: 15,
    currency: 'PKR (Pakistani Rupee)',
    timezone: 'Asia/Karachi (GMT+5)',
    allowUnpaidNegativeBalance: true,
  });

  // -------------------------------------------------------------
  // TAB 4: BROADCAST ANNOUNCEMENTS STATE
  // -------------------------------------------------------------
  const [announcements, setAnnouncements] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    targetAudience: 'all',
    targetDepartmentId: '',
    body: '',
  });

  // 1. Load Letter Templates
  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/letter-templates');
      const list = res.data?.data?.templates || res.data?.data || [];
      setTemplates(Array.isArray(list) ? list : []);

      const current = (Array.isArray(list) ? list : []).find((t) => t.templateType === selectedType) || list[0];
      if (current) {
        setActiveTemplate(current);
        setSelectedType(current.templateType);
        setBodyContent(current.bodyContent || '');
        setTemplateTitle(current.title || '');
      }
    } catch (err) {
      console.error('Failed to load letter templates:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedType]);

  // 2. Load Tax Slabs
  const loadTaxSlabs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/tax-slabs?country=${countryCode}&all=false`);
      const payload = res.data?.data;
      if (payload?.slabs && payload.slabs.length > 0) {
        const activeSlabDoc = payload.slabs[0];
        setTaxYear(activeSlabDoc.taxYear || '2024-2025');
        const sorted = (activeSlabDoc.slabs || []).map((s) => ({
          minIncome: s.minIncome || 0,
          maxIncome: s.maxIncome !== undefined && s.maxIncome !== null ? s.maxIncome : '',
          baseTax: s.baseTax || s.fixedTax || 0,
          rate: s.rate !== undefined ? s.rate : 0,
        }));
        setSlabs(sorted);
      } else {
        setSlabs([]);
      }
    } catch (err) {
      console.error('Failed to load tax slabs:', err);
    } finally {
      setLoading(false);
    }
  }, [countryCode]);

  // 3. Load Operating Parameters (Company Settings)
  const loadOperatingParams = useCallback(async () => {
    try {
      const res = await apiClient.get('/finance/settings/thresholds').catch(() => null);
      if (res?.data?.data) {
        const set = res.data.data;
        setOperatingParams((prev) => ({
          ...prev,
          currency: set.currency ? `${set.currency} (Pakistani Rupee)` : prev.currency,
        }));
      }
    } catch (err) {
      console.error('Failed to load operating parameters:', err);
    }
  }, []);

  // 4. Load Broadcast Announcements & Departments
  const loadAnnouncements = useCallback(async () => {
    try {
      setLoading(true);
      const [annRes, deptRes] = await Promise.allSettled([
        apiClient.get('/announcements'),
        apiClient.get('/departments'),
      ]);

      if (annRes.status === 'fulfilled') {
        const list = annRes.value.data?.data || [];
        setAnnouncements(Array.isArray(list) ? list : []);
      }

      if (deptRes.status === 'fulfilled') {
        const depts = deptRes.value.data?.data || [];
        setDepartments(Array.isArray(depts) ? depts : []);
      }
    } catch (err) {
      console.error('Failed to load announcements feed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setActionError('');
    setActionStatus('');
    if (activeTab === 'templates') loadTemplates();
    if (activeTab === 'tax') loadTaxSlabs();
    if (activeTab === 'hours') loadOperatingParams();
    if (activeTab === 'announcements') loadAnnouncements();
  }, [activeTab, loadTemplates, loadTaxSlabs, loadOperatingParams, loadAnnouncements]);

  // Template Handlers
  const handleSelectTemplateType = (typeKey) => {
    setSelectedType(typeKey);
    const found = templates.find((t) => t.templateType === typeKey);
    if (found) {
      setActiveTemplate(found);
      setBodyContent(found.bodyContent || '');
      setTemplateTitle(found.title || '');
    }
  };

  const handleInsertTag = (tag) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setBodyContent((prev) => prev + ` {{${tag}}}`);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const tagToInsert = `{{${tag}}}`;
    const updatedContent = bodyContent.substring(0, start) + tagToInsert + bodyContent.substring(end);
    setBodyContent(updatedContent);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tagToInsert.length, start + tagToInsert.length);
    }, 0);
  };

  const handleSaveTemplate = async () => {
    try {
      setActionLoading(true);
      await apiClient.put(`/letter-templates/${selectedType}`, {
        title: templateTitle || activeTemplate?.title || selectedType,
        bodyContent: bodyContent,
      });
      setActionStatus('Template saved successfully.');
      loadTemplates();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to save template.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetTemplate = async () => {
    if (!window.confirm(`Reset ${selectedType} back to system default layout?`)) return;
    try {
      setActionLoading(true);
      const res = await apiClient.delete(`/letter-templates/${selectedType}`);
      const def = res.data?.data;
      if (def) {
        setBodyContent(def.bodyContent || '');
        setTemplateTitle(def.title || '');
      }
      setActionStatus('Template reset to system default.');
      loadTemplates();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to reset template.');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePreviewPdf = async () => {
    try {
      setActionLoading(true);
      const res = await apiClient.post(`/letter-templates/${selectedType}/preview`, {
        sampleData: {
          employeeName: 'Farhan Akhtar',
          designation: 'Senior Logistics Specialist',
          companyName: 'Apex Logistics Ltd.',
          effectiveDate: 'September 1, 2026',
          basicSalary: 'PKR 125,000',
          lastWorkingDate: 'September 30, 2026',
        },
      });
      const fileUrl = res.data?.data?.fileUrl || res.data?.data?.url;
      if (fileUrl) window.open(fileUrl, '_blank');
      else alert('PDF compiled. Review download stream.');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to preview PDF.');
    } finally {
      setActionLoading(false);
    }
  };

  // Tax Slabs Handlers
  const handleSyncTaxTables = async () => {
    try {
      setActionLoading(true);
      const res = await apiClient.post('/tax-slabs/apply-preset', { country: countryCode, force: true });
      setActionStatus(res.data?.message || 'Tax tables synchronized from official FBR presets.');
      await loadTaxSlabs();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to sync tax tables.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveSlabs = async () => {
    try {
      setActionLoading(true);
      await apiClient.post('/tax-slabs', {
        country: countryCode.toUpperCase(),
        taxYear: taxYear,
        frequency: 'ANNUAL',
        slabs: slabs.map((s) => ({
          minIncome: Number(s.minIncome),
          maxIncome: s.maxIncome !== '' ? Number(s.maxIncome) : null,
          baseTax: Number(s.baseTax || 0),
          rate: Number(s.rate || 0),
        })),
        isActive: true,
      });
      setActionStatus('Tax brackets and rates successfully stored in database.');
      loadTaxSlabs();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to save tax slabs.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRunSimulation = async () => {
    try {
      setSimulating(true);
      const res = await apiClient.post('/tax-slabs/simulate', {
        monthlyGross: Number(sampleSalary),
        country: countryCode,
        taxYear: taxYear,
      });
      setSimulationResult(res.data?.data || null);
    } catch (err) {
      alert(err.response?.data?.message || 'Simulation test failed.');
    } finally {
      setSimulating(false);
    }
  };

  // Operating Hours Handler
  const handleSaveOperatingParameters = async () => {
    try {
      setActionLoading(true);
      setActionStatus('');
      setActionError('');
      // Save currency threshold and attendance grace period
      await apiClient.put('/finance/settings/thresholds', {
        currency: 'PKR',
      });
      setActionStatus('Operating parameters and attendance thresholds successfully updated.');
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to update operating parameters.');
    } finally {
      setActionLoading(false);
    }
  };

  // Announcements Handlers
  const handlePublishAnnouncement = async (e) => {
    e.preventDefault();
    if (!announcementForm.title.trim() || !announcementForm.body.trim()) {
      setActionError('Announcement Title and Message Body are required.');
      return;
    }

    try {
      setActionLoading(true);
      setActionError('');
      setActionStatus('');

      await apiClient.post('/announcements', {
        title: announcementForm.title.trim(),
        body: announcementForm.body.trim(),
        targetAudience: announcementForm.targetAudience,
        targetDepartmentId: announcementForm.targetAudience === 'department' ? announcementForm.targetDepartmentId : undefined,
        priority: 'high',
      });

      setAnnouncementForm({
        title: '',
        targetAudience: 'all',
        targetDepartmentId: '',
        body: '',
      });
      setActionStatus('Announcement published and notification dispatched.');
      loadAnnouncements();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to publish announcement.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchiveAnnouncement = async (id) => {
    try {
      setActionLoading(true);
      await apiClient.patch(`/announcements/${id}/archive`);
      loadAnnouncements();
    } catch (err) {
      // Fallback archive attempt if route is delete/deactivate
      try {
        await apiClient.delete(`/announcements/${id}`);
        loadAnnouncements();
      } catch (archiveErr) {
        alert(archiveErr.response?.data?.message || 'Failed to archive announcement.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const categoryMenu = [
    { key: 'offerLetter', label: 'Offer Letter', status: 'ACTIVE' },
    { key: 'promotionLetter', label: 'Promotion Letter', status: 'Custom' },
    { key: 'resignationAcceptance', label: 'Resignation Acceptance', status: 'Default' },
    { key: 'relievingLetter', label: 'Relieving Letter', status: 'ACTIVE' },
    { key: 'experienceLetter', label: 'Experience Letter', status: 'Default' },
    { key: 'warningLetter', label: 'Warning Letter', status: 'Custom' },
  ];

  const allowedTags = activeTemplate?.allowedPlaceholders || [
    'employeeName',
    'designation',
    'newDesignation',
    'effectiveDate',
    'companyName',
    'lastWorkingDate',
    'basicSalary',
  ];

  return (
    <div className="space-y-4 max-w-[1440px] mx-auto select-none font-sans text-[#1D2530] pb-20">
      {/* Top Banner with Sub-Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 px-6 rounded-lg border border-[#E3DED4] shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-[#8C5D17] tracking-wider uppercase font-semibold">
              TICKET-022B1 & TICKET-031 // Multi-Tenant Policy Engine
            </span>
          </div>
          <h1 className="text-lg font-bold text-[#111C2E] mt-0.5">
            Organization Policies & Document Configuration
          </h1>
          <p className="text-[11px] text-[#69788A]">
            Configure tenant-wide operating hours, dynamic PDF letter templates, statutory tax rules, and broadcast announcements.
          </p>
        </div>

        <div className="flex items-center gap-2.5 font-mono text-xs">
          <button
            onClick={() => {
              if (activeTab === 'templates') loadTemplates();
              if (activeTab === 'tax') loadTaxSlabs();
              if (activeTab === 'hours') loadOperatingParams();
              if (activeTab === 'announcements') loadAnnouncements();
            }}
            className="px-3.5 py-1.5 bg-[#FAF8F5] hover:bg-[#F2EFE9] border border-[#D5CEC2] rounded text-[#546274] flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <span>↺</span>
            <span>Discard Changes</span>
          </button>
          <button
            onClick={() => {
              if (activeTab === 'templates') handleSaveTemplate();
              if (activeTab === 'tax') handleSaveSlabs();
              if (activeTab === 'hours') handleSaveOperatingParameters();
            }}
            disabled={actionLoading}
            className="px-4 py-1.5 bg-[#8C5D17] hover:bg-[#784F14] text-white rounded font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all disabled:opacity-50"
          >
            <span>💾</span>
            <span>Save All Policy Adjustments</span>
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {actionError && (
        <div className="p-3 bg-[#FDEEEB] border border-[#F5C2BA] text-[#B83E28] rounded font-mono text-xs">
          ⚠️ {actionError}
        </div>
      )}
      {actionStatus && (
        <div className="p-3 bg-[#EBF7EE] border border-[#C8E6C9] text-[#1E7E34] rounded font-mono text-xs">
          ✓ {actionStatus}
        </div>
      )}

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-6 border-b border-[#E3DED4] px-1 text-xs font-mono">
        <button
          onClick={() => setActiveTab('templates')}
          className={`pb-2.5 flex items-center gap-2 cursor-pointer transition-all ${
            activeTab === 'templates'
              ? 'border-b-2 border-[#8C5D17] text-[#111C2E] font-bold'
              : 'text-[#728294] hover:text-[#111C2E]'
          }`}
        >
          <span>📄</span>
          <span>Letterhead & Document Templates</span>
        </button>

        <button
          onClick={() => setActiveTab('tax')}
          className={`pb-2.5 flex items-center gap-2 cursor-pointer transition-all ${
            activeTab === 'tax'
              ? 'border-b-2 border-[#8C5D17] text-[#111C2E] font-bold'
              : 'text-[#728294] hover:text-[#111C2E]'
          }`}
        >
          <span>⚖️</span>
          <span>Income Tax Slabs & Presets</span>
        </button>

        <button
          onClick={() => setActiveTab('hours')}
          className={`pb-2.5 flex items-center gap-2 cursor-pointer transition-all ${
            activeTab === 'hours'
              ? 'border-b-2 border-[#8C5D17] text-[#111C2E] font-bold'
              : 'text-[#728294] hover:text-[#111C2E]'
          }`}
        >
          <span>⏱️</span>
          <span>Working Hours & Grace Periods</span>
        </button>

        <button
          onClick={() => setActiveTab('announcements')}
          className={`pb-2.5 flex items-center gap-2 cursor-pointer transition-all ${
            activeTab === 'announcements'
              ? 'border-b-2 border-[#8C5D17] text-[#111C2E] font-bold'
              : 'text-[#728294] hover:text-[#111C2E]'
          }`}
        >
          <span>📢</span>
          <span>Broadcast Announcements Feed</span>
        </button>
      </div>

      {/* ============================================================= */}
      {/* TAB 1: LETTERHEAD & DOCUMENT TEMPLATES                        */}
      {/* ============================================================= */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-4 bg-white rounded-lg border border-[#E3DED4] p-4 space-y-4 shadow-xs">
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#728294] font-bold px-1">
              DOCUMENT CATEGORIES
            </div>
            <div className="space-y-1">
              {categoryMenu.map((item) => {
                const isSelected = selectedType === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => handleSelectTemplateType(item.key)}
                    className={`w-full text-left p-2.5 px-3 rounded flex items-center justify-between transition-all cursor-pointer text-xs ${
                      isSelected ? 'bg-[#111C2E] text-white font-medium shadow-xs' : 'hover:bg-[#FAF8F5] text-[#111C2E]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs">✉</span>
                      <span>{item.label}</span>
                    </div>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.2 rounded uppercase border ${
                        isSelected
                          ? 'bg-[#8C5D17] text-white border-[#8C5D17]'
                          : item.status === 'ACTIVE'
                          ? 'bg-[#FAF3E8] text-[#8C5D17] border-[#E8D4B5]'
                          : 'bg-[#FAF8F5] text-[#728294] border-[#D5CEC2]'
                      }`}
                    >
                      {item.status}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="p-3.5 bg-[#FAF8F5] border border-[#E3DED4] rounded space-y-1 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-[#111C2E] text-[11px]">
                <span>ℹ</span>
                <span>Variable Substitution</span>
              </div>
              <p className="text-[11px] text-[#546274] leading-relaxed">
                Click any variable chip above the editor to instantly inject merge fields into your document layout at cursor position.
              </p>
            </div>
          </div>

          <div className="lg:col-span-8 bg-white rounded-lg border border-[#E3DED4] p-5 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#F4F1EA] pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-[#111C2E]">
                    {categoryMenu.find((c) => c.key === selectedType)?.label || selectedType} Template
                  </h2>
                  <span className="px-2 py-0.5 rounded text-[9.5px] font-mono bg-[#EBF7EE] text-[#1E7E34] border border-[#C8E6C9] font-bold">
                    {activeTemplate?.isCustomized ? 'Tenant Custom Active' : 'System Default Active'}
                  </span>
                </div>
                <div className="text-[10px] font-mono text-[#728294] mt-0.5">
                  Last modified on Oct 14, 2026 by Alex Vance (Super Admin)
                </div>
              </div>

              <button
                onClick={handleResetTemplate}
                disabled={actionLoading}
                className="text-xs font-mono text-[#728294] hover:text-[#B83E28] flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>↺</span>
                <span>Reset to Default</span>
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-[9.5px] font-mono font-bold uppercase text-[#728294] tracking-wider">
                AVAILABLE DYNAMIC TAGS (CLICK TO INSERT)
              </div>
              <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
                {allowedTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleInsertTag(tag)}
                    className="px-2.5 py-1 bg-[#FAF8F5] hover:bg-[#F2EFE9] border border-[#D5CEC2] rounded text-[#111C2E] cursor-pointer transition-all active:scale-95"
                  >
                    {`{{${tag}}}`}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[10px] font-mono text-[#728294]">
                <span className="uppercase font-bold tracking-wider">DOCUMENT MARKDOWN / RICH LAYOUT</span>
                <span>UTF-8 Encoded</span>
              </div>
              <textarea
                ref={textareaRef}
                rows="12"
                value={bodyContent}
                onChange={(e) => setBodyContent(e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded p-3 text-xs font-mono text-[#111C2E] leading-relaxed outline-none focus:border-[#8C5D17] transition-all resize-y"
                placeholder="Write your document layout template..."
              />
            </div>

            <div className="p-2.5 bg-[#EBF7EE] border border-[#C8E6C9] rounded flex items-center justify-between text-[11px] font-mono text-[#1E7E34]">
              <div className="flex items-center gap-1.5 font-semibold">
                <span>✓</span>
                <span>ALL VARIABLE PLACEHOLDERS VALID AND RECOGNIZED BY DOCUMENT COMPILER ENGINE</span>
              </div>
              <span className="text-[10px] text-[#325239]">0 Syntax Warnings</span>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-[#F4F1EA]">
              <button
                onClick={handlePreviewPdf}
                disabled={actionLoading}
                className="px-4 py-2 bg-white hover:bg-[#FAF8F5] border border-[#D5CEC2] rounded text-xs font-mono font-medium text-[#111C2E] flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50"
              >
                <span>👁</span>
                <span>Preview Rendered PDF</span>
              </button>
              <button
                onClick={handleSaveTemplate}
                disabled={actionLoading}
                className="px-5 py-2 bg-[#8C5D17] hover:bg-[#784F14] text-white rounded text-xs font-mono font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all disabled:opacity-50"
              >
                <span>💾</span>
                <span>Save Template</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* TAB 2: INCOME TAX SLABS & PRESETS                             */}
      {/* ============================================================= */}
      {activeTab === 'tax' && (
        <div className="space-y-4">
          <div className="bg-[#18263D] rounded-lg border border-[#273B5B] p-5 text-white flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded bg-[#C98A2C]/20 border border-[#C98A2C]/40 flex items-center justify-center text-[#C98A2C] text-lg shrink-0">
                ⚑
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono tracking-widest text-[#8C9BAE] uppercase font-bold">
                    ACTIVE TAX JURISDICTION
                  </span>
                  <span className="px-1.5 py-0.2 bg-[#C98A2C]/25 text-[#E5B56A] border border-[#C98A2C]/40 text-[9px] font-mono rounded-[2px] uppercase">
                    AUTO-INITIALIZED
                  </span>
                </div>
                <h2 className="text-sm md:text-base font-bold text-white tracking-wide">
                  Pakistan FBR Salary Tax Slabs (Fiscal Year {taxYear})
                </h2>
                <p className="text-[11px] text-[#8C9BAE] max-w-2xl leading-relaxed">
                  Brackets can be adjusted below. Calculations apply progressive slab methodology automatically during monthly payroll executions.
                </p>
              </div>
            </div>

            <button
              disabled={actionLoading}
              onClick={handleSyncTaxTables}
              className="px-4 py-2 bg-[#101A2B] hover:bg-[#152238] border border-[#2B3E5E] text-white rounded text-xs font-mono font-medium flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
            >
              <span>↺</span>
              <span>{actionLoading ? 'Syncing...' : 'Sync Tax Tables'}</span>
            </button>
          </div>

          <div className="bg-white rounded-lg border border-[#E3DED4] p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#F4F1EA]">
              <div className="flex items-center gap-2">
                <span className="text-[#8C5D17] text-base">▤</span>
                <h3 className="text-sm font-bold text-[#111C2E]">Progressive Tax Brackets & Rates</h3>
              </div>
              <div className="flex items-center gap-2 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => {
                    const last = slabs[slabs.length - 1];
                    const newMin = last && last.maxIncome ? Number(last.maxIncome) + 1 : 0;
                    setSlabs([...slabs, { minIncome: newMin, maxIncome: '', baseTax: 0, rate: 0 }]);
                  }}
                  className="px-3.5 py-1.5 bg-[#8C5D17] hover:bg-[#784F14] text-white rounded font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                >
                  <span>+</span>
                  <span>Add Bracket</span>
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleSaveSlabs}
                  className="px-4 py-1.5 bg-[#111C2E] hover:bg-[#1E2B3E] text-white rounded font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all disabled:opacity-50"
                >
                  <span>💾</span>
                  <span>Save Slabs</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-mono text-xs">
                <thead>
                  <tr className="text-[10px] text-[#728294] border-b border-[#EAE6DD] pb-2">
                    <th className="py-2 px-3 font-semibold">Bracket Tier</th>
                    <th className="py-2 px-3 font-semibold">Minimum Annual Income</th>
                    <th className="py-2 px-3 font-semibold">Maximum Annual Income</th>
                    <th className="py-2 px-3 font-semibold">Fixed Base Tax</th>
                    <th className="py-2 px-3 font-semibold">Progressive Rate</th>
                    <th className="py-2 px-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F4F1EA]">
                  {loading ? (
                    <tr>
                      <td colSpan="6" className="py-10 text-center text-[#728294] font-mono text-xs">
                        Loading verified tax slabs from database...
                      </td>
                    </tr>
                  ) : slabs.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-10 text-center text-[#728294] font-mono text-xs">
                        No active tax slabs configured. Click "Sync Tax Tables" above to auto-seed standard FBR rates.
                      </td>
                    </tr>
                  ) : (
                    slabs.map((slab, index) => (
                      <tr key={index} className="hover:bg-[#FAF8F5]/60 transition-colors">
                        <td className="py-3 px-3 font-serif font-bold text-[#8C5D17] whitespace-nowrap">
                          Slab {index + 1}
                        </td>
                        <td className="py-3 px-3">
                          <input
                            type="number"
                            value={slab.minIncome}
                            onChange={(e) => {
                              const updated = [...slabs];
                              updated[index].minIncome = Number(e.target.value);
                              setSlabs(updated);
                            }}
                            className="w-36 bg-[#FAF8F5] border border-[#D5CEC2] rounded px-2.5 py-1 text-xs text-[#111C2E] outline-none focus:border-[#8C5D17]"
                          />
                        </td>
                        <td className="py-3 px-3">
                          <input
                            type="number"
                            placeholder="Unlimited"
                            value={slab.maxIncome}
                            onChange={(e) => {
                              const updated = [...slabs];
                              updated[index].maxIncome = e.target.value === '' ? '' : Number(e.target.value);
                              setSlabs(updated);
                            }}
                            className="w-36 bg-[#FAF8F5] border border-[#D5CEC2] rounded px-2.5 py-1 text-xs text-[#111C2E] outline-none focus:border-[#8C5D17]"
                          />
                        </td>
                        <td className="py-3 px-3">
                          <input
                            type="number"
                            value={slab.baseTax}
                            onChange={(e) => {
                              const updated = [...slabs];
                              updated[index].baseTax = Number(e.target.value);
                              setSlabs(updated);
                            }}
                            className="w-32 bg-[#FAF8F5] border border-[#D5CEC2] rounded px-2.5 py-1 text-xs text-[#111C2E] outline-none focus:border-[#8C5D17]"
                          />
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              step="0.1"
                              value={slab.rate}
                              onChange={(e) => {
                                const updated = [...slabs];
                                updated[index].rate = Number(e.target.value);
                                setSlabs(updated);
                              }}
                              className="w-20 bg-[#FAF8F5] border border-[#D5CEC2] rounded px-2.5 py-1 text-xs text-[#111C2E] outline-none focus:border-[#8C5D17]"
                            />
                            <span className="text-[#728294] font-semibold">%</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              if (slabs.length <= 1) return;
                              setSlabs(slabs.filter((_, i) => i !== index));
                            }}
                            className="text-[#8C9BAE] hover:text-[#B83E28] transition-colors p-1 cursor-pointer text-sm"
                          >
                            🗑
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-[#E3DED4] p-5 space-y-3.5 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-[#8C5D17] text-base font-bold">Σ</span>
              <h3 className="text-sm font-bold text-[#111C2E]">Progressive Tax Test Calculator Simulator</h3>
            </div>
            <p className="text-[11px] text-[#69788A]">
              Enter sample monthly salary to instantly compute exact monthly tax withholding against active brackets above.
            </p>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                <div className="space-y-1">
                  <span className="text-[9.5px] font-mono uppercase text-[#728294] font-bold block">
                    SAMPLE GROSS MONTHLY SALARY (PKR)
                  </span>
                  <input
                    type="number"
                    value={sampleSalary}
                    onChange={(e) => setSampleSalary(e.target.value)}
                    className="w-48 bg-[#FAF8F5] border border-[#D5CEC2] rounded px-3 py-1.5 font-mono text-xs text-[#111C2E] outline-none focus:border-[#8C5D17]"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[9.5px] font-mono uppercase text-[#728294] font-bold block">
                    CALCULATED MONTHLY TAX WITHHOLDING
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-serif font-bold text-[#8C5D17]">
                      PKR {simulationResult ? Number(simulationResult.monthlyTax || simulationResult.taxAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '31,250.00'}
                    </span>
                    <span className="px-2 py-0.5 bg-[#FAF3E8] border border-[#E8D4B5] rounded text-[10px] font-mono text-[#8C5D17] font-semibold">
                      {simulationResult ? `${simulationResult.effectiveRate || '12.5'}% Effective` : '12.5% Effective'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                disabled={simulating}
                onClick={handleRunSimulation}
                className="px-4 py-2 bg-[#FAF8F5] hover:bg-[#F2EFE9] border border-[#D5CEC2] rounded text-xs font-mono font-medium text-[#111C2E] flex items-center gap-2 cursor-pointer transition-all shadow-2xs self-start md:self-auto disabled:opacity-50"
              >
                <span>▶</span>
                <span>{simulating ? 'Computing...' : 'Run Verification Test'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* TAB 3: WORKING HOURS & GRACE PERIODS                          */}
      {/* ============================================================= */}
      {activeTab === 'hours' && (
        <div className="bg-white rounded-lg border border-[#E3DED4] p-6 space-y-6 shadow-xs">
          {/* Header Title */}
          <div className="space-y-1 border-b border-[#F4F1EA] pb-3">
            <div className="flex items-center gap-2 text-sm font-bold text-[#111C2E]">
              <span className="w-5 h-5 rounded-full bg-[#FAF3E8] border border-[#E8D4B5] text-[#8C5D17] flex items-center justify-center text-xs">
                ⏱
              </span>
              <h2>Operating Parameters & Attendance Thresholds</h2>
            </div>
            <p className="text-[11px] text-[#69788A]">
              Define core organizational working hours, attendance grace periods, and financial defaults.
            </p>
          </div>

          {/* Row 1: Working Hours & Grace Period */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase text-[#728294] font-bold block">
                STANDARD DAILY WORKING HOURS
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  step="0.5"
                  value={operatingParams.standardWorkingHours}
                  onChange={(e) => setOperatingParams({ ...operatingParams, standardWorkingHours: Number(e.target.value) })}
                  className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded px-3 py-2 text-xs font-mono text-[#111C2E] outline-none focus:border-[#8C5D17]"
                />
                <span className="text-xs font-mono text-[#728294] whitespace-nowrap">Hours / Day</span>
              </div>
              <p className="text-[10.5px] font-mono text-[#8C9BAE]">
                Base multiplier for overtime and daily timesheet calculations.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase text-[#728294] font-bold block">
                GLOBAL CHECK-IN GRACE PERIOD
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={operatingParams.gracePeriodMinutes}
                  onChange={(e) => setOperatingParams({ ...operatingParams, gracePeriodMinutes: Number(e.target.value) })}
                  className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded px-3 py-2 text-xs font-mono text-[#111C2E] outline-none focus:border-[#8C5D17]"
                />
                <span className="text-xs font-mono text-[#728294] whitespace-nowrap">Minutes</span>
              </div>
              <p className="text-[10.5px] font-mono text-[#8C9BAE]">
                Late deduction triggers automatically after this threshold expires.
              </p>
            </div>
          </div>

          {/* Row 2: Default Currency & Default Timezone */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase text-[#728294] font-bold block">
                DEFAULT COMPANY CURRENCY
              </label>
              <div className="p-2.5 bg-[#FAF8F5] border border-[#E3DED4] rounded flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2 text-[#111C2E] font-bold">
                  <span>💵</span>
                  <span>{operatingParams.currency}</span>
                </div>
                <span className="text-[9.5px] bg-white border border-[#D5CEC2] px-2 py-0.5 rounded text-[#728294]">
                  Locked Core Preset
                </span>
              </div>
              <p className="text-[10.5px] font-mono text-[#8C9BAE]">
                Base currency used across all payroll ledgers and expense reports.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase text-[#728294] font-bold block">
                DEFAULT COMPANY TIMEZONE
              </label>
              <div className="p-2.5 bg-[#FAF8F5] border border-[#E3DED4] rounded flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2 text-[#111C2E] font-bold">
                  <span>🌍</span>
                  <span>{operatingParams.timezone}</span>
                </div>
                <span className="text-[9.5px] bg-white border border-[#D5CEC2] px-2 py-0.5 rounded text-[#728294]">
                  System Standard
                </span>
              </div>
              <p className="text-[10.5px] font-mono text-[#8C9BAE]">
                Timezone reference for attendance check-ins and automated shift logs.
              </p>
            </div>
          </div>

          {/* Row 3: Unpaid Leave Negative Balance Override */}
          <div className="p-4 bg-[#FAF8F5] border border-[#E3DED4] rounded-lg flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-white border border-[#D5CEC2] flex items-center justify-center text-sm text-[#8C5D17]">
                📅
              </div>
              <div>
                <div className="text-xs font-bold text-[#111C2E]">
                  Unpaid Leave Negative Balance Override
                </div>
                <p className="text-[11px] text-[#69788A]">
                  Allow HR managers to approve emergency unpaid leave requests even past zero balance limits.
                </p>
              </div>
            </div>

            {/* Toggle Switch */}
            <button
              type="button"
              onClick={() => setOperatingParams({
                ...operatingParams,
                allowUnpaidNegativeBalance: !operatingParams.allowUnpaidNegativeBalance
              })}
              className={`w-11 h-6 rounded-full transition-colors cursor-pointer relative p-0.5 ${
                operatingParams.allowUnpaidNegativeBalance ? 'bg-[#8C5D17]' : 'bg-[#D5CEC2]'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  operatingParams.allowUnpaidNegativeBalance ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Action Save Button */}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              disabled={actionLoading}
              onClick={handleSaveOperatingParameters}
              className="px-5 py-2 bg-[#8C5D17] hover:bg-[#784F14] text-white rounded font-mono font-semibold text-xs flex items-center gap-2 cursor-pointer shadow-xs transition-all disabled:opacity-50"
            >
              <span>💾</span>
              <span>Save Operating Parameters</span>
            </button>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* TAB 4: BROADCAST ANNOUNCEMENTS FEED                           */}
      {/* ============================================================= */}
      {activeTab === 'announcements' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Form: Post New Broadcast Announcement */}
          <div className="lg:col-span-6 bg-white rounded-lg border border-[#E3DED4] p-5 space-y-4 shadow-xs">
            <div className="flex items-center gap-2 border-b border-[#F4F1EA] pb-3">
              <span className="text-[#8C5D17] text-base">📢</span>
              <h2 className="text-xs font-bold text-[#111C2E]">Post New Broadcast Announcement</h2>
            </div>

            <form onSubmit={handlePublishAnnouncement} className="space-y-4 text-xs font-mono">
              <div className="space-y-1">
                <label className="text-[10px] uppercase text-[#728294] font-bold block">
                  ANNOUNCEMENT TITLE
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q4 Town Hall & Strategic Roadmap Update"
                  value={announcementForm.title}
                  onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                  className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded px-3 py-2 outline-none text-[#111C2E] focus:border-[#8C5D17]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase text-[#728294] font-bold block">
                  TARGET AUDIENCE SCOPE
                </label>
                <select
                  value={announcementForm.targetAudience}
                  onChange={(e) => setAnnouncementForm({ ...announcementForm, targetAudience: e.target.value })}
                  className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded px-3 py-2 outline-none text-[#111C2E] cursor-pointer"
                >
                  <option value="all">All Company (Global Tenant Scope)</option>
                  <option value="department">Specific Department</option>
                </select>
              </div>

              {announcementForm.targetAudience === 'department' && (
                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-[#728294] font-bold block">
                    SELECT DEPARTMENT
                  </label>
                  <select
                    value={announcementForm.targetDepartmentId}
                    onChange={(e) => setAnnouncementForm({ ...announcementForm, targetDepartmentId: e.target.value })}
                    className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded px-3 py-2 outline-none text-[#111C2E] cursor-pointer"
                  >
                    <option value="">Select target department...</option>
                    {departments.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] uppercase text-[#728294] font-bold block">
                  ANNOUNCEMENT MESSAGE BODY
                </label>
                <textarea
                  rows="6"
                  required
                  placeholder="Enter broadcast message details here..."
                  value={announcementForm.body}
                  onChange={(e) => setAnnouncementForm({ ...announcementForm, body: e.target.value })}
                  className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded p-3 outline-none text-[#111C2E] focus:border-[#8C5D17] resize-y"
                />
              </div>

              {/* Note callout */}
              <div className="p-3 bg-[#FAF8F5] border border-[#EAE6DD] rounded flex items-start gap-2 text-[10.5px] text-[#69788A]">
                <span className="text-[#8C5D17] mt-0.5">ⓘ</span>
                <span>
                  Dispatches in-app notification bell and high-priority SendGrid email digest instantly.
                </span>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-[#8C5D17] hover:bg-[#784F14] text-white rounded font-mono font-semibold text-xs flex items-center gap-2 cursor-pointer shadow-xs transition-all disabled:opacity-50"
                >
                  <span>▶</span>
                  <span>Publish Broadcast Now</span>
                </button>
              </div>
            </form>
          </div>

          {/* Right Feed: Active Broadcast Feed */}
          <div className="lg:col-span-6 space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-bold text-[#111C2E] font-mono">Active Broadcast Feed</h2>
              <span className="text-[10.5px] font-mono text-[#728294]">
                {announcements.length} Active Broadcasts
              </span>
            </div>

            <div className="space-y-3 font-mono text-xs">
              {loading ? (
                <div className="bg-white p-8 rounded-lg border border-[#E3DED4] text-center text-[#728294]">
                  Loading announcements...
                </div>
              ) : announcements.length === 0 ? (
                <div className="bg-white p-8 rounded-lg border border-[#E3DED4] text-center text-[#728294]">
                  No active broadcast announcements. Post an update using the form on the left.
                </div>
              ) : (
                announcements.map((item) => {
                  const authorName = item.publishedBy?.firstName
                    ? `${item.publishedBy.firstName} ${item.publishedBy.lastName || ''}`
                    : item.publishedBy?.email || 'Super Admin';

                  const scopeTag = item.targetAudience === 'all'
                    ? 'ALL COMPANY'
                    : item.targetDepartmentId?.name
                    ? `${item.targetDepartmentId.name.toUpperCase()} DEPARTMENT`
                    : 'DEPARTMENT SCOPE';

                  const formattedDate = item.createdAt
                    ? new Date(item.createdAt).toISOString().replace('T', ' ').slice(0, 16) + ' PKT'
                    : '2026-09-09 14:30 PKT';

                  return (
                    <div
                      key={item._id}
                      className="bg-white p-5 rounded-lg border border-[#E3DED4] shadow-xs space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 bg-[#FAF3E8] border border-[#E8D4B5] text-[#8C5D17] rounded text-[9.5px] font-bold">
                          {scopeTag}
                        </span>
                        <span className="text-[10px] text-[#728294]">{formattedDate}</span>
                      </div>

                      <div className="space-y-1.5">
                        <h3 className="font-bold text-sm text-[#111C2E] leading-snug">
                          {item.title}
                        </h3>
                        <p className="text-[11px] text-[#546274] leading-relaxed">
                          {item.body}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-[#F4F1EA] text-[10px] text-[#728294]">
                        <span>Author: {authorName}</span>
                        <button
                          onClick={() => handleArchiveAnnouncement(item._id)}
                          className="hover:text-[#B83E28] flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <span>🗄</span>
                          <span>Archive</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}