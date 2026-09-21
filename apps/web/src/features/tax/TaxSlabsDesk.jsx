import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../lib/apiClient.js';

export default function TaxSlabsDesk() {
  const [activeConfig, setActiveConfig] = useState(null);
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applyingPreset, setApplyingPreset] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Simulation State
  const [simulationGross, setSimulationGross] = useState(150000);
  const [simulationResult, setSimulationResult] = useState(null);
  const [simulating, setSimulating] = useState(false);

  // 1. Fetch Current Slabs & Presets
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [slabsRes, presetsRes] = await Promise.all([
        apiClient.get('/tax-slabs').catch(() => ({ data: { data: {} } })),
        apiClient.get('/tax-slabs/presets').catch(() => ({ data: { data: [] } })),
      ]);

      const slabData = slabsRes.data?.data?.slabs || [];
      setActiveConfig(slabData.length > 0 ? slabData[0] : null);
      setPresets(presetsRes.data?.data || []);
    } catch (err) {
      console.warn('Failed to load tax configuration:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 2. Apply Built-in Preset
  const handleApplyPreset = async (countryCode) => {
    if (!window.confirm(`Apply standard tax preset for ${countryCode}? Existing configuration will be archived.`)) return;
    try {
      setApplyingPreset(true);
      setFeedback(null);
      const res = await apiClient.post('/tax-slabs/apply-preset', {
        country: countryCode,
        force: true,
      });
      setFeedback({ text: res.data?.message || 'Tax preset applied successfully.', ok: true });
      fetchData();
    } catch (err) {
      setFeedback({ text: err.response?.data?.message || 'Failed to apply preset.', ok: false });
    } finally {
      setApplyingPreset(false);
    }
  };

  // 3. Trigger Progressive Tax Simulation
  const handleSimulate = async (e) => {
    if (e) e.preventDefault();
    if (!simulationGross || simulationGross <= 0) return;

    try {
      setSimulating(true);
      const res = await apiClient.post('/tax-slabs/simulate', {
        monthlyGross: Number(simulationGross),
      });
      setSimulationResult(res.data?.data || null);
    } catch (err) {
      console.warn('Simulation error:', err);
    } finally {
      setSimulating(false);
    }
  };

  useEffect(() => {
    if (activeConfig) {
      handleSimulate();
    }
  }, [activeConfig]);

  return (
    <div className="space-y-6 font-sans text-[#16233B] select-none">
      
      {/* Feedback Banner */}
      {feedback && (
        <div className={`p-3 rounded text-xs font-mono border ${
          feedback.ok ? 'bg-[#EBF7F0] border-[#C6EAD3] text-[#1E7E34]' : 'bg-[#FDEEEB] border-[#F5C2BA] text-[#B83E28]'
        }`}>
          {feedback.text}
        </div>
      )}

      {/* Top Presets Ribbon */}
      <div className="bg-white p-4 rounded-lg border border-[#E3DED4] shadow-2xs flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <span className="text-[9.5px] font-mono uppercase tracking-wider text-[#728294] font-bold">
            STATUTORY TAX PRESETS
          </span>
          <h3 className="text-sm font-bold text-[#16233B] mt-0.5">Built-in Regional Tax Brackets</h3>
          <p className="text-xs text-[#5B6B79]">Pre-configured progressive income tax formulas according to statutory labor codes.</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => handleApplyPreset('PK')}
            disabled={applyingPreset}
            className="px-3 py-1.5 bg-[#FAF8F5] hover:bg-[#FAF4E8] border border-[#D8D3C7] text-xs font-mono font-bold text-[#8C5D17] rounded cursor-pointer transition-colors shadow-2xs disabled:opacity-50"
          >
            🇵🇰 FBR Pakistan Slabs
          </button>
        </div>
      </div>

      {/* Main Grid: Active Slabs vs Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Active Slabs Table */}
        <div className="lg:col-span-7 bg-white rounded-lg border border-[#E3DED4] shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-[#E3DED4] flex justify-between items-center bg-[#FAF8F5]">
            <div>
              <span className="text-[9.5px] font-mono uppercase text-[#728294] font-bold">
                ENFORCED SCHEDULE ({activeConfig?.taxYear || '2026-2027'})
              </span>
              <h3 className="text-sm font-bold text-[#16233B] mt-0.5">
                Progressive Salary Slabs ({activeConfig?.country || 'PK'})
              </h3>
            </div>
            <span className="px-2 py-0.5 bg-[#EBF7F0] border border-[#C6EAD3] text-[#1E7E34] text-[9.5px] font-mono font-bold rounded">
              ACTIVE
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#FAF8F5] border-b border-[#E3DED4] text-[10px] text-[#728294] uppercase">
                <tr>
                  <th className="py-2.5 px-4">Bracket Range (PKR)</th>
                  <th className="py-2.5 px-3">Base Tax</th>
                  <th className="py-2.5 px-3 text-right">Marginal Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F4F1EA]">
                {loading ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-[#728294]">
                      Loading tax slab schedule...
                    </td>
                  </tr>
                ) : !activeConfig || !activeConfig.slabs || activeConfig.slabs.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-[#728294]">
                      No active tax brackets found. Apply a regional preset above.
                    </td>
                  </tr>
                ) : (
                  activeConfig.slabs.map((bracket, idx) => (
                    <tr key={idx} className="hover:bg-[#FAF8F5]/60 transition-colors">
                      <td className="py-3 px-4 text-[#16233B]">
                        {bracket.minIncome.toLocaleString()} &rarr;{' '}
                        {bracket.maxIncome ? `${bracket.maxIncome.toLocaleString()} PKR` : 'Above'}
                      </td>
                      <td className="py-3 px-3 text-[#5B6B79]">
                        {bracket.fixedAmount > 0 ? `${bracket.fixedAmount.toLocaleString()} PKR` : '0 PKR'}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-[#8C5D17]">
                        {bracket.rate}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Real-Time Tax Simulation Engine */}
        <div className="lg:col-span-5 bg-white rounded-lg border border-[#E3DED4] p-5 shadow-2xs space-y-4">
          <div>
            <span className="text-[9.5px] font-mono uppercase tracking-wider text-[#728294] font-bold">
              ESTIMATOR WORKBENCH
            </span>
            <h3 className="text-sm font-bold text-[#16233B] mt-0.5">Simulate Progressive Tax</h3>
            <p className="text-xs text-[#5B6B79]">Verify monthly withholding deductions against current progressive brackets.</p>
          </div>

          <form onSubmit={handleSimulate} className="space-y-3 text-xs">
            <div>
              <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1">
                Monthly Gross Compensation (PKR)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={simulationGross}
                  onChange={(e) => setSimulationGross(e.target.value)}
                  className="w-full p-2 border border-[#D8D3C7] rounded outline-none font-mono text-xs focus:border-[#8C5D17]"
                />
                <button
                  type="submit"
                  disabled={simulating}
                  className="px-3.5 py-2 bg-[#8C5D17] hover:bg-[#784F14] text-white font-mono font-bold rounded cursor-pointer shrink-0 disabled:opacity-50"
                >
                  {simulating ? '...' : 'Compute'}
                </button>
              </div>
            </div>
          </form>

          {simulationResult && (
            <div className="pt-3 border-t border-[#E3DED4] space-y-3 font-mono">
              <div className="grid grid-cols-2 gap-2 bg-[#FAF8F5] p-3 rounded border border-[#E3DED4]">
                <div>
                  <span className="text-[9.5px] text-[#728294] block uppercase">Monthly Tax</span>
                  <span className="text-base font-bold text-[#B83E28]">
                    {Math.round(simulationResult.monthlyTax || simulationResult.taxPerMonth || 0).toLocaleString()} PKR
                  </span>
                </div>
                <div>
                  <span className="text-[9.5px] text-[#728294] block uppercase">Annual Tax</span>
                  <span className="text-base font-bold text-[#16233B]">
                    {Math.round(simulationResult.annualTax || simulationResult.taxPerYear || 0).toLocaleString()} PKR
                  </span>
                </div>
              </div>

              <div className="p-3 bg-[#EBF7F0] border border-[#C6EAD3] rounded flex justify-between items-center text-xs">
                <span className="text-[#1E7E34] font-bold">Estimated Net In-Hand:</span>
                <span className="text-sm font-bold text-[#1E7E34]">
                  {Math.round((Number(simulationGross) || 0) - (simulationResult.monthlyTax || simulationResult.taxPerMonth || 0)).toLocaleString()} PKR
                </span>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}