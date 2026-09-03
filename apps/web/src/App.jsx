import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginScreen from './features/auth/LoginScreen.jsx';
import ComponentShowcase from './pages/ComponentShowcase.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import SuperAdminLayout from './features/superAdmin/SuperAdminLayout.jsx';
import BillingInvoices from './features/superAdmin/BillingInvoices.jsx';
import AuditLogs from './features/superAdmin/AuditLogs.jsx';
import PlansTiers from './features/superAdmin/PlansTiers.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginScreen />} />
      <Route path="/dev/components" element={<ComponentShowcase />} />

      {/* Super Admin Protected Enclave */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute requiredRole="SUPER_ADMIN">
            <SuperAdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/admin/billing" replace />} />
        <Route path="plans" element={<PlansTiers />} />
        <Route path="billing" element={<BillingInvoices />} />
        <Route path="audit" element={<AuditLogs />} />
      </Route>

      <Route path="/" element={<Navigate to="/admin/billing" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
