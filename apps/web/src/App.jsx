import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ComponentShowcase from './pages/ComponentShowcase.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/dev/components" element={<ComponentShowcase />} />
      <Route path="*" element={<Navigate to="/dev/components" replace />} />
    </Routes>
  );
}