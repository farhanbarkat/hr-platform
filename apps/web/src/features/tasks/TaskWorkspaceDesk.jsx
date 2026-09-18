import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../lib/apiClient.js';
import { useAuth } from '../../context/AuthContext.jsx';
import CreateTaskModal from './CreateTaskModal.jsx';
import TaskAttachmentDrawer from './TaskAttachmentDrawer.jsx';

export default function TaskWorkspaceDesk() {
  const { user, isSuperAdmin, isCompanyAdmin } = useAuth();

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  // Active Stopwatch State
  const [activeTimer, setActiveTimer] = useState(null);
  const [timerSeconds, setTimerSeconds] = useState(0);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [inspectTaskForFiles, setInspectTaskForFiles] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // 1. Fetch Board Tasks
  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      let query = '/tasks';
      if (statusFilter) query += `?status=${statusFilter}`;
      const res = await apiClient.get(query);
      setTasks(res.data?.data || []);
    } catch (err) {
      console.warn('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  // 2. Fetch Active Stopwatch
  const fetchActiveTimer = useCallback(async () => {
    try {
      const res = await apiClient.get('/task-time-logs/active');
      const timer = res.data?.data?.activeTimer || null;
      setActiveTimer(timer);

      if (timer && timer.startedAt) {
        const elapsed = Math.max(0, Math.floor((new Date().getTime() - new Date(timer.startedAt).getTime()) / 1000));
        setTimerSeconds(elapsed);
      }
    } catch (err) {
      console.warn('Timer check error:', err);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchActiveTimer();
  }, [fetchTasks, fetchActiveTimer]);

  // Live Timer Ticker
  useEffect(() => {
    let interval = null;
    if (activeTimer) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setTimerSeconds(0);
    }
    return () => clearInterval(interval);
  }, [activeTimer]);

  // 3. Start Timer on Task
  const handleStartTimer = async (taskId) => {
    try {
      setFeedback(null);
      const res = await apiClient.post('/task-time-logs/start', { taskId });
      setFeedback({ text: 'Timer active and tracking duration.', ok: true });
      fetchActiveTimer();
    } catch (err) {
      setFeedback({
        text: err.response?.data?.message || 'Failed to start timer.',
        ok: false,
      });
    }
  };

  // 4. Stop Active Timer
  const handleStopTimer = async () => {
    if (!activeTimer) return;
    try {
      setFeedback(null);
      await apiClient.post('/task-time-logs/stop', {
        timeLogId: activeTimer._id,
        taskId: activeTimer.taskId?._id || activeTimer.taskId,
      });
      setFeedback({ text: 'Time log logged to task ledger.', ok: true });
      setActiveTimer(null);
    } catch (err) {
      setFeedback({
        text: err.response?.data?.message || 'Failed to stop timer.',
        ok: false,
      });
    }
  };

  // 5. Update Task Status (Kanban Columns)
  const handleStatusChange = async (taskId, nextStatus) => {
    try {
      await apiClient.patch(`/tasks/${taskId}/status`, { status: nextStatus });
      fetchTasks();
    } catch (err) {
      setFeedback({
        text: err.response?.data?.message || 'Failed to update task status.',
        ok: false,
      });
    }
  };

  const formatTime = (secs) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const filteredTasks = tasks.filter((t) => {
    const title = (t.title || '').toLowerCase();
    const assignee = `${t.assignedTo?.firstName || ''} ${t.assignedTo?.lastName || ''}`.toLowerCase();
    const term = search.toLowerCase();
    return title.includes(term) || assignee.includes(term);
  });

  const columns = [
    { id: 'TODO', label: 'To Do / Backlog', border: 'border-[#E3DED4]' },
    { id: 'IN_PROGRESS', label: 'In Progress', border: 'border-[#8C5D17]' },
    { id: 'COMPLETED', label: 'Completed / Verified', border: 'border-[#1E7E34]' },
  ];

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto select-none font-sans text-[#16233B] pb-24">
      
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E3DED4] gap-4">
        <div>
          <span className="text-[10px] font-mono tracking-widest text-[#728294] uppercase font-semibold">
            TASK ORCHESTRATION & TELEMETRY // WORKSPACE DESK
          </span>
          <h1 className="text-2xl font-serif font-bold tracking-tight text-[#16233B] mt-0.5">
            Operational Task & Time Desk
          </h1>
          <p className="text-xs text-[#5B6B79] mt-0.5">
            Team workload board, real-time stopwatch session logging, and deliverable document enclave.
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 bg-[#8C5D17] hover:bg-[#784F14] text-white text-xs font-mono font-bold rounded cursor-pointer transition-all shadow-xs"
        >
          + CREATE NEW TASK
        </button>
      </div>

      {/* Active Timer Sticky Ribbon */}
      {activeTimer && (
        <div className="p-3.5 bg-[#FAF4E8] border border-[#E8D4B5] rounded-lg flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-[#1E7E34] animate-ping" />
            <div>
              <span className="text-[9.5px] font-mono uppercase tracking-wider text-[#8C5D17] font-bold block">
                ACTIVE TIME LOG STOPWATCH
              </span>
              <span className="text-xs font-bold text-[#16233B]">
                {activeTimer.taskId?.title || 'Tracking Current Task'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="font-mono text-lg font-bold text-[#16233B]">
              {formatTime(timerSeconds)}
            </div>
            <button
              onClick={handleStopTimer}
              className="px-3 py-1 bg-[#B83E28] hover:bg-[#97321F] text-white text-xs font-mono font-bold rounded cursor-pointer"
            >
              ■ Stop Timer
            </button>
          </div>
        </div>
      )}

      {feedback && (
        <div className={`p-3 rounded text-xs font-mono border ${
          feedback.ok
            ? 'bg-[#EBF7F0] border-[#C6EAD3] text-[#1E7E34]'
            : 'bg-[#FDEEEB] border-[#F5C2BA] text-[#B83E28]'
        }`}>
          {feedback.text}
        </div>
      )}

      {/* 2. Filter & Search Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-[#E3DED4] shadow-2xs">
        <input
          type="text"
          placeholder="Filter by title or assignee..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm px-3 py-1.5 border border-[#D8D3C7] rounded text-xs font-sans outline-none focus:border-[#8C5D17]"
        />

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-[#728294]">Status:</span>
          {['', 'TODO', 'IN_PROGRESS', 'COMPLETED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                statusFilter === st
                  ? 'bg-[#16233B] text-white'
                  : 'bg-[#FAF8F5] border border-[#E3DED4] text-[#728294] hover:text-[#16233B]'
              }`}
            >
              {st || 'ALL'}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Kanban Workspace Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
        {columns.map((col) => {
          const colTasks = filteredTasks.filter((t) => t.status === col.id);

          return (
            <div
              key={col.id}
              className="bg-[#FAF8F5]/60 border border-[#E3DED4] rounded-lg p-4 flex flex-col min-h-[500px]"
            >
              <div className="flex justify-between items-center pb-2.5 mb-3 border-b border-[#E3DED4]">
                <span className="text-xs font-mono font-bold text-[#16233B] uppercase">
                  {col.label}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white border border-[#E3DED4] text-[#728294] font-bold">
                  {colTasks.length}
                </span>
              </div>

              <div className="space-y-3 flex-1 overflow-y-auto">
                {colTasks.length === 0 ? (
                  <div className="py-12 text-center text-xs font-mono text-[#728294] border border-dashed border-[#E3DED4] rounded">
                    No tasks in this lane.
                  </div>
                ) : (
                  colTasks.map((task) => {
                    const isTaskTimerRunning = activeTimer && (activeTimer.taskId?._id || activeTimer.taskId) === task._id;

                    return (
                      <div
                        key={task._id}
                        className="bg-white border border-[#E3DED4] rounded-lg p-3.5 shadow-2xs hover:border-[#8C5D17]/60 transition-all space-y-2.5"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <span className={`text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                            task.priority === 'URGENT' || task.priority === 'HIGH'
                              ? 'bg-[#FDEEEB] text-[#B83E28] border border-[#F5C2BA]'
                              : 'bg-[#FAF4E8] text-[#8C5D17] border border-[#E8D4B5]'
                          }`}>
                            {task.priority}
                          </span>

                          <span className="text-[10px] font-mono text-[#728294]">
                            Due: {new Date(task.deadline).toLocaleDateString()}
                          </span>
                        </div>

                        <div>
                          <h4 className="text-xs font-bold text-[#16233B] leading-snug">
                            {task.title}
                          </h4>
                          {task.description && (
                            <p className="text-[11px] text-[#5B6B79] line-clamp-2 mt-1">
                              {task.description}
                            </p>
                          )}
                        </div>

                        <div className="pt-2 border-t border-[#F4F1EA] flex justify-between items-center text-[10.5px] font-mono">
                          <span className="text-[#728294] truncate max-w-[130px]">
                            👤 {task.assignedTo?.firstName} {task.assignedTo?.lastName || ''}
                          </span>

                          <div className="flex items-center gap-1.5">
                            {/* File Artifacts Drawer */}
                            <button
                              onClick={() => setInspectTaskForFiles(task)}
                              title="View & Attach Documents"
                              className="px-2 py-0.5 bg-[#FAF8F5] border border-[#D8D3C7] text-[#728294] hover:text-[#16233B] rounded text-[10px] font-bold cursor-pointer"
                            >
                              📎 Files
                            </button>

                            {/* Stopwatch Start/Stop */}
                            {isTaskTimerRunning ? (
                              <button
                                onClick={handleStopTimer}
                                className="px-2 py-0.5 bg-[#B83E28] text-white rounded text-[10px] font-bold cursor-pointer"
                              >
                                ■ Stop
                              </button>
                            ) : (
                              <button
                                onClick={() => handleStartTimer(task._id)}
                                className="px-2 py-0.5 bg-[#1E7E34] text-white rounded text-[10px] font-bold cursor-pointer hover:bg-[#18662A]"
                              >
                                ▶ Log
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Quick Lane Transfer Controls */}
                        <div className="pt-1 flex gap-1 justify-end font-mono text-[9px]">
                          {col.id !== 'TODO' && (
                            <button
                              onClick={() => handleStatusChange(task._id, 'TODO')}
                              className="text-[#728294] hover:underline cursor-pointer"
                            >
                              &larr; ToDo
                            </button>
                          )}
                          {col.id !== 'IN_PROGRESS' && (
                            <button
                              onClick={() => handleStatusChange(task._id, 'IN_PROGRESS')}
                              className="text-[#8C5D17] hover:underline cursor-pointer ml-1"
                            >
                              In Progress
                            </button>
                          )}
                          {col.id !== 'COMPLETED' && (
                            <button
                              onClick={() => handleStatusChange(task._id, 'COMPLETED')}
                              className="text-[#1E7E34] hover:underline cursor-pointer ml-1 font-bold"
                            >
                              Done &rarr;
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Create Task */}
      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onTaskCreated={fetchTasks}
      />

      {/* Drawer: S3 Files Enclave */}
      <TaskAttachmentDrawer
        task={inspectTaskForFiles}
        onClose={() => setInspectTaskForFiles(null)}
      />

    </div>
  );
}