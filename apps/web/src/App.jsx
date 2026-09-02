import React from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import LoginScreen from './features/auth/LoginScreen.jsx';
import ComponentShowcase from './pages/ComponentShowcase.jsx';
import { Button, Card } from '@repo/ui';

function Dashboard() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen bg-[#F6F5F1] p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#16233B]">Employee Operations Workspace</h1>
          <p className="text-xs font-mono text-[#5B6B79] mt-1">
            Logged in as: {user?.name || user?.email} | Role: {user?.role}
          </p>
        </div>
        <Button variant="secondary" onClick={logout}>Sign Out</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="space-y-3">
          <h3 className="font-semibold text-sm text-[#16233B]">General Workspace</h3>
          <p className="text-xs text-[#5B6B79]">Accessible to all authenticated staff members.</p>
        </Card>

        <Card className="space-y-3">
          <h3 className="font-semibold text-sm text-[#16233B]">Payroll Audit Module</h3>
          <p className="text-xs text-[#5B6B79]">Requires granular permission: payroll:process</p>
          <Link to="/payroll-restricted">
            <Button variant="ghost" className="text-xs underline text-[#B9812E]">
              Test Permission-Gated Route →
            </Button>
          </Link>
        </Card>
      </div>
    </div>
  );
}

function PayrollModule() {
  return (
    <div className="min-h-screen bg-[#F6F5F1] p-8 max-w-4xl mx-auto">
      <Card className="space-y-3">
        <h2 className="text-xl font-bold text-[#16233B]">Confidential Payroll Disbursals</h2>
        <p className="text-xs text-[#2E7D5B] font-semibold">
          Access Granted: Account verified with permission 'payroll:process'.
        </p>
        <Link to="/dashboard">
          <Button variant="secondary">Back to Dashboard</Button>
        </Link>
      </Card>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/dev/components" element={<ComponentShowcase />} />

        {/* Protected general route */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* Protected route guarded by permission string, not just role name */}
        <Route
          path="/payroll-restricted"
          element={
            <ProtectedRoute requiredPermission="payroll:process">
              <PayrollModule />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  );
}