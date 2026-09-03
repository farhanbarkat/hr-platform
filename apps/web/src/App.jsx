import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginScreen from './features/auth/LoginScreen.jsx';
import ComponentShowcase from './pages/ComponentShowcase.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';

export default function App() {
  return (
    <Routes>
      {/* Public Auth Route */}
      <Route path="/login" element={<LoginScreen />} />

      {/* Dev Component Showcase */}
      <Route path="/dev/components" element={<ComponentShowcase />} />

      {/* Fallback & Redirects */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}