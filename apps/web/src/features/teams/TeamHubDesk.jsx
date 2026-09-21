import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../lib/apiClient.js';
import { useAuth } from '../../context/AuthContext.jsx';
import CreateTeamModal from './CreateTeamModal.jsx';
import ManageMembersModal from './ManageMembersModal.jsx';

export default function TeamHubDesk() {
  const { user, isSuperAdmin, isCompanyAdmin } = useAuth();

  const [teams, setTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isManageMembersOpen, setIsManageMembersOpen] = useState(false);

  const [discussionBody, setDiscussionBody] = useState('');
  const [postingMessage, setPostingMessage] = useState(false);

  // 1. Safe Load Dashboard Function
  const loadDashboard = useCallback(async (teamId) => {
    if (!teamId) return;
    try {
      setDashboardLoading(true);
      const res = await apiClient.get(`/teams/${teamId}/dashboard`);
      const data = res.data?.data || null;
      setDashboardData(data);
    } catch (err) {
      console.warn('Dashboard fetch notice:', err?.response?.data?.message || err.message);
      setDashboardData(null);
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  // 2. Fetch Teams List on Mount
  const loadTeams = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/teams');
      const rawList = res.data?.data;
      const list = Array.isArray(rawList) ? rawList : [];
      setTeams(list);

      if (list.length > 0) {
        // Agar pehle se koi selected hai toh use preserve karein, warna pehla select karein
        const targetId = selectedTeamId && list.some((t) => t._id === selectedTeamId)
          ? selectedTeamId
          : list[0]._id;
        setSelectedTeamId(targetId);
        loadDashboard(targetId);
      } else {
        setSelectedTeamId(null);
        setDashboardData(null);
      }
    } catch (err) {
      console.warn('Teams load notice:', err?.response?.data?.message || err.message);
      setTeams([]);
    } finally {
      setLoading(false);
    }
  }, [loadDashboard, selectedTeamId]);

  useEffect(() => {
    loadTeams();
  }, []);

  // 3. Select Team Handler
  const handleSelectTeam = (id) => {
    if (id === selectedTeamId) return;
    setSelectedTeamId(id);
    loadDashboard(id);
  };

  // 4. Send Message Handler
  const handlePostDiscussion = async (e) => {
    e.preventDefault();
    if (!discussionBody.trim() || !selectedTeamId) return;

    try {
      setPostingMessage(true);
      await apiClient.post(`/teams/${selectedTeamId}/discussions`, {
        body: discussionBody.trim(),
      });
      setDiscussionBody('');
      loadDashboard(selectedTeamId);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to post message.');
    } finally {
      setPostingMessage(false);
    }
  };

  const canCreateTeam =
    isSuperAdmin ||
    isCompanyAdmin ||
    user?.role === 'HR' ||
    user?.role === 'MANAGER';

  // Defensive parsing for summary metrics
  const attendance = dashboardData?.attendanceSnapshot || {
    totalTeamSize: 0,
    presentToday: 0,
    absentToday: 0,
  };

  const taskSummary = dashboardData?.taskBoardSummary || {
    totalTasks: 0,
    todo: 0,
    inProgress: 0,
    completed: 0,
  };

  const discussionsList = Array.isArray(dashboardData?.discussions)
    ? dashboardData.discussions
    : [];

  const selectedTeamObj = teams.find((t) => t._id === selectedTeamId) || dashboardData?.team;

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto select-none font-sans text-[#16233B] pb-24">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E3DED4] gap-4">
        <div>
          <span className="text-[10px] font-mono tracking-widest text-[#728294] uppercase font-semibold">
            COLLABORATION & SQUAD TELEMETRY // TEAM HUB
          </span>
          <h1 className="text-2xl font-serif font-bold tracking-tight text-[#16233B] mt-0.5">
            Team Workspaces & Squad Dashboard
          </h1>
          <p className="text-xs text-[#5B6B79] mt-0.5">
            Monitor real-time squad attendance, track shared deliverables, and collaborate via persistent team discussions.
          </p>
        </div>

        {canCreateTeam && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-[#8C5D17] hover:bg-[#784F14] text-white text-xs font-mono font-bold rounded cursor-pointer transition-all shadow-xs"
          >
            + FORM NEW TEAM
          </button>
        )}
      </div>

      {/* Main Grid: Left Squads Directory + Right Squad Center */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Squads Directory */}
        <div className="lg:col-span-4 bg-white rounded-lg border border-[#E3DED4] p-4 shadow-2xs space-y-3">
          <div className="flex justify-between items-center pb-2 border-b border-[#E3DED4]">
            <span className="text-[10px] font-mono uppercase text-[#728294] font-bold">
              ACTIVE SQUADS ({teams.length})
            </span>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {loading ? (
              <div className="py-8 text-center text-xs font-mono text-[#728294]">
                Loading company squads...
              </div>
            ) : teams.length === 0 ? (
              <div className="py-8 text-center text-xs font-mono text-[#728294]">
                No teams configured yet.
              </div>
            ) : (
              teams.map((t) => {
                const isSelected = selectedTeamId === t._id;
                const manager = t.managerId || t.manager || {};
                const managerName = manager.firstName
                  ? `${manager.firstName} ${manager.lastName || ''}`.trim()
                  : 'Manager';

                return (
                  <button
                    key={t._id}
                    onClick={() => handleSelectTeam(t._id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all cursor-pointer flex flex-col gap-1 ${
                      isSelected
                        ? 'bg-[#FAF4E8] border-[#8C5D17] shadow-xs'
                        : 'bg-white border-[#E3DED4] hover:bg-[#FAF8F5]'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-xs text-[#16233B]">{t.name}</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white border border-[#E3DED4] text-[#8C5D17]">
                        {t.department || 'General'}
                      </span>
                    </div>
                    <div className="text-[10px] text-[#728294] font-mono">
                      Lead: {managerName} • {Array.isArray(t.members) ? t.members.length : 0} Members
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Dashboard Enclave */}
        <div className="lg:col-span-8 space-y-5">
          {dashboardLoading ? (
            <div className="bg-white p-12 rounded-lg border border-[#E3DED4] text-center text-xs font-mono text-[#728294]">
              Aggregating live team telemetry...
            </div>
          ) : !dashboardData ? (
            <div className="bg-white p-12 rounded-lg border border-[#E3DED4] text-center text-xs font-mono text-[#728294]">
              Select a team from the squad directory to view telemetry.
            </div>
          ) : (
            <>
              {/* Selected Squad Control Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-4 rounded-lg border border-[#E3DED4] shadow-2xs gap-3">
                <div>
                  <span className="text-[9px] font-mono text-[#728294] uppercase tracking-wider block">
                    ACTIVE SQUAD WORKSPACE
                  </span>
                  <h2 className="text-base font-serif font-bold text-[#16233B]">
                    {dashboardData.team?.name || 'Squad'}
                  </h2>
                </div>

                {canCreateTeam && (
                  <button
                    onClick={() => setIsManageMembersOpen(true)}
                    className="px-3.5 py-1.5 bg-[#FAF8F5] hover:bg-[#FAF4E8] border border-[#8C5D17] text-[#8C5D17] text-xs font-mono font-bold rounded cursor-pointer transition-all shadow-xs"
                  >
                    ⚙️ MANAGE SQUAD MEMBERS ({selectedTeamObj?.members?.length || 0})
                  </button>
                )}
              </div>

              {/* Top Stats: Attendance & Tasks */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                <div className="bg-white p-3.5 rounded-lg border border-[#E3DED4] shadow-2xs">
                  <span className="text-[9px] text-[#728294] uppercase block">TODAY PRESENT</span>
                  <span className="text-xl font-bold text-[#1E7E34]">
                    {attendance.presentToday || 0}{' '}
                    <span className="text-xs font-normal text-[#728294]">
                      / {attendance.totalTeamSize || 0}
                    </span>
                  </span>
                </div>

                <div className="bg-white p-3.5 rounded-lg border border-[#E3DED4] shadow-2xs">
                  <span className="text-[9px] text-[#728294] uppercase block">TODAY ABSENT</span>
                  <span className="text-xl font-bold text-[#B83E28]">
                    {attendance.absentToday || 0}
                  </span>
                </div>

                <div className="bg-white p-3.5 rounded-lg border border-[#E3DED4] shadow-2xs">
                  <span className="text-[9px] text-[#728294] uppercase block">IN PROGRESS TASKS</span>
                  <span className="text-xl font-bold text-[#8C5D17]">
                    {taskSummary.inProgress || 0}
                  </span>
                </div>

                <div className="bg-white p-3.5 rounded-lg border border-[#E3DED4] shadow-2xs">
                  <span className="text-[9px] text-[#728294] uppercase block">COMPLETED TASKS</span>
                  <span className="text-xl font-bold text-[#16233B]">
                    {taskSummary.completed || 0}{' '}
                    <span className="text-xs font-normal text-[#728294]">
                      / {taskSummary.totalTasks || 0}
                    </span>
                  </span>
                </div>
              </div>

              {/* Discussion Thread */}
              <div className="bg-white rounded-lg border border-[#E3DED4] shadow-2xs overflow-hidden flex flex-col h-[450px]">
                <div className="p-3.5 border-b border-[#E3DED4] bg-[#FAF8F5] flex justify-between items-center">
                  <div>
                    <span className="text-[9px] font-mono uppercase text-[#728294] font-bold">
                      SQUAD HUDDLE // PERSISTENT DISCUSSION
                    </span>
                    <h3 className="text-xs font-bold text-[#16233B]">
                      {dashboardData.team?.name || 'Team'} Discussion Thread
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-[#728294]">
                    {discussionsList.length} messages
                  </span>
                </div>

                {/* Message Stream */}
                <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#FAF8F5]/30">
                  {discussionsList.length === 0 ? (
                    <div className="py-12 text-center text-xs font-mono text-[#728294]">
                      No messages in this team channel yet. Start the conversation below!
                    </div>
                  ) : (
                    discussionsList.map((msg, index) => {
                      const author = msg?.authorId || {};
                      const authorName = author.firstName
                        ? `${author.firstName} ${author.lastName || ''}`.trim()
                        : author.name || 'Team Member';

                      return (
                        <div
                          key={msg._id || index}
                          className="bg-white p-3 rounded border border-[#E3DED4] space-y-1 shadow-2xs"
                        >
                          <div className="flex justify-between items-center text-[10px] font-mono">
                            <span className="font-bold text-[#16233B]">
                              👤 {authorName}{' '}
                              <span className="text-[#728294]">
                                ({author.designation || 'Member'})
                              </span>
                            </span>
                            <span className="text-[#728294]">
                              {msg.createdAt
                                ? new Date(msg.createdAt).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : ''}
                            </span>
                          </div>
                          <p className="text-xs text-[#16233B] font-sans whitespace-pre-wrap">
                            {msg.body}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Post Message Input */}
                <form
                  onSubmit={handlePostDiscussion}
                  className="p-3 border-t border-[#E3DED4] bg-white flex gap-2"
                >
                  <input
                    type="text"
                    value={discussionBody}
                    onChange={(e) => setDiscussionBody(e.target.value)}
                    placeholder="Type an announcement, update, or question for the squad..."
                    className="flex-1 p-2 border border-[#D8D3C7] rounded text-xs outline-none focus:border-[#8C5D17]"
                  />
                  <button
                    type="submit"
                    disabled={postingMessage}
                    className="px-4 py-2 bg-[#8C5D17] hover:bg-[#784F14] text-white text-xs font-mono font-bold rounded cursor-pointer transition-colors disabled:opacity-50"
                  >
                    {postingMessage ? '...' : 'Send'}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 1. Modal Form Team */}
      <CreateTeamModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onTeamCreated={loadTeams}
      />

      {/* 2. Modal Manage Existing Squad Members */}
      <ManageMembersModal
        isOpen={isManageMembersOpen}
        onClose={() => setIsManageMembersOpen(false)}
        team={selectedTeamObj}
        onMembersUpdated={async () => {
          const res = await apiClient.get('/teams');
          const list = Array.isArray(res.data?.data) ? res.data.data : [];
          setTeams(list);
          if (selectedTeamId) {
            loadDashboard(selectedTeamId);
          }
        }}
      />
    </div>
  );
}