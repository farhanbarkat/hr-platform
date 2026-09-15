import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../lib/apiClient.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function AttendancePunchCard({ onRecordUpdated }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [todayRecord, setTodayRecord] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [coords, setCoords] = useState(null);
  const [geoError, setGeoError] = useState('');
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // 1. Live Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 2. Fetch Geo Location
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          setGeoError('');
        },
        (err) => {
          setGeoError(
            err.code === 1
              ? 'Location permission denied. GPS check-in may fail geofence check.'
              : 'Unable to retrieve GPS coordinates.'
          );
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setGeoError('Geolocation is not supported by your browser.');
    }
  }, []);

  // 3. Fetch today's record for currently logged-in user
  const fetchTodayStatus = useCallback(async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const res = await apiClient.get(`/attendance?date=${todayStr}`);
      const records = res.data?.data || [];
      if (records.length > 0) {
        setTodayRecord(records[0]);
      } else {
        setTodayRecord(null);
      }
    } catch (err) {
      console.warn('Failed to fetch today attendance record:', err);
    }
  }, []);

  useEffect(() => {
    fetchTodayStatus();
  }, [fetchTodayStatus]);

 // Check-in Handler
  const handleCheckIn = async () => {
    try {
      setLoading(true);
      setFeedback({ type: '', text: '' });

      const payload = {
        employeeId: user?.employeeId || user?.employee?._id,
        checkInTime: new Date().toISOString(),
        checkInMethod: coords ? 'GPS' : 'MANUAL',
        ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
      };

      const res = await apiClient.post('/attendance/check-in', payload);
      setTodayRecord(res.data?.data);
      setFeedback({ type: 'success', text: 'Checked in successfully.' });
      if (onRecordUpdated) onRecordUpdated();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.message || 'Check-in failed.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Check-out Handler
  const handleCheckOut = async () => {
    try {
      setLoading(true);
      setFeedback({ type: '', text: '' });

      const payload = {
        employeeId: user?.employeeId || user?.employee?._id,
        checkOutTime: new Date().toISOString(),
        checkOutMethod: coords ? 'GPS' : 'MANUAL',
        ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
      };

      const res = await apiClient.post('/attendance/check-out', payload);
      setTodayRecord(res.data?.data);
      setFeedback({ type: 'success', text: 'Checked out successfully.' });
      if (onRecordUpdated) onRecordUpdated();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.message || 'Check-out failed.',
      });
    } finally {
      setLoading(false);
    }
  };

  const isCheckedIn = Boolean(todayRecord?.checkInTime);
  const isCheckedOut = Boolean(todayRecord?.checkOutTime);

  return (
    <div className="bg-white border border-[#E3DED4] rounded-lg p-5 shadow-xs font-mono text-xs select-none">
      <div className="flex items-center justify-between pb-3 border-b border-[#F4F1EA]">
        <span className="text-[10px] uppercase font-bold text-[#728294] tracking-widest">
          LIVE WORKSTATION PUNCH CLOCK
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded bg-[#FAF8F5] border border-[#E3DED4] text-[#8C5D17] font-bold">
          {coords ? '📍 GPS Locked' : '⚠️ Manual / No GPS'}
        </span>
      </div>

      {geoError && (
        <div className="mt-3 p-2 bg-[#FDEEEB] border border-[#F5C2BA] text-[#B83E28] rounded text-[10px]">
          {geoError}
        </div>
      )}

      {feedback.text && (
        <div
          className={`mt-3 p-2.5 rounded text-[11px] ${
            feedback.type === 'success'
              ? 'bg-[#EBF7F0] border border-[#C6EAD3] text-[#1E7E34]'
              : 'bg-[#FDEEEB] border border-[#F5C2BA] text-[#B83E28]'
          }`}
        >
          {feedback.text}
        </div>
      )}

      <div className="my-5 text-center">
        <div className="text-2xl font-bold text-[#16233B] tracking-wider">
          {currentTime.toLocaleTimeString()}
        </div>
        <div className="text-[11px] text-[#728294] mt-0.5">
          {currentTime.toLocaleDateString(undefined, {
            weekday: 'long',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </div>
      </div>

      {/* Record Metrics if checked in */}
      {isCheckedIn && (
        <div className="grid grid-cols-2 gap-2 my-4 p-3 bg-[#FAF8F5] rounded border border-[#E3DED4] text-[11px]">
          <div>
            <span className="text-[#728294] block text-[9.5px] uppercase">Punched In:</span>
            <span className="font-bold text-[#16233B]">
              {new Date(todayRecord.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div>
            <span className="text-[#728294] block text-[9.5px] uppercase">Status:</span>
            <span className={`font-bold ${todayRecord.lateMinutes > 0 ? 'text-[#B83E28]' : 'text-[#1E7E34]'}`}>
              {todayRecord.status} {todayRecord.lateMinutes > 0 ? `(${todayRecord.lateMinutes}m Late)` : ''}
            </span>
          </div>
          {isCheckedOut && (
            <>
              <div>
                <span className="text-[#728294] block text-[9.5px] uppercase">Punched Out:</span>
                <span className="font-bold text-[#16233B]">
                  {new Date(todayRecord.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div>
                <span className="text-[#728294] block text-[9.5px] uppercase">Working Time:</span>
                <span className="font-bold text-[#8C5D17]">
                  {Math.floor(todayRecord.totalWorkingMinutes / 60)}h {todayRecord.totalWorkingMinutes % 60}m
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="pt-2">
        {!isCheckedIn ? (
          <button
            onClick={handleCheckIn}
            disabled={loading}
            className="w-full py-2.5 bg-[#8C5D17] hover:bg-[#784F14] text-white font-bold rounded shadow-xs cursor-pointer transition-all disabled:opacity-50 tracking-wider"
          >
            {loading ? 'PUNCHING IN...' : 'PUNCH IN (START WORK)'}
          </button>
        ) : !isCheckedOut ? (
          <button
            onClick={handleCheckOut}
            disabled={loading}
            className="w-full py-2.5 bg-[#16233B] hover:bg-[#111C2E] text-white font-bold rounded shadow-xs cursor-pointer transition-all disabled:opacity-50 tracking-wider"
          >
            {loading ? 'PUNCHING OUT...' : 'PUNCH OUT (END WORK)'}
          </button>
        ) : (
          <div className="text-center p-2.5 bg-[#EBF7F0] text-[#1E7E34] border border-[#C6EAD3] rounded font-bold">
            ✓ Shifts Concluded for Today
          </div>
        )}
      </div>
    </div>
  );
}