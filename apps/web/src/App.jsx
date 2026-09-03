import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginScreen from './features/auth/LoginScreen.jsx';
import ComponentShowcase from './pages/ComponentShowcase.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import SuperAdminLayout from './features/superAdmin/SuperAdminLayout.jsx';

export default function App() {
  return (
    <Routes>
      {/* Public Auth Route */}
      <Route path="/login" element={<LoginScreen />} />

      {/* Dev Component Showcase */}
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

      </Route>

      {/* Fallback & Redirects */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}