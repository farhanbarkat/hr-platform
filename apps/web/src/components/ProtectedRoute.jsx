import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Card, Button } from '@repo/ui';

export const ProtectedRoute = ({ children, requiredPermission, requiredPermissions = [] }) => {
  const { isAuthenticated, isLoading, hasPermission, hasAnyPermission, logout } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F6F5F1] flex items-center justify-center">
        <div className="font-mono text-sm text-[#5B6B79] animate-pulse">
          Validating Session...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check single permission string
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <AccessDeniedScreen missingPermission={requiredPermission} onLogout={logout} />;
  }

  // Check any permission in list
  if (requiredPermissions.length > 0 && !hasAnyPermission(requiredPermissions)) {
    return <AccessDeniedScreen missingPermission={requiredPermissions.join(', ')} onLogout={logout} />;
  }

  return children;
};

const AccessDeniedScreen = ({ missingPermission, onLogout }) => (
  <div className="min-h-screen bg-[#F6F5F1] flex items-center justify-center p-4">
    <Card className="max-w-md w-full text-center space-y-4 border-l-[4px] border-l-[#B3432E]">
      <div className="h-12 w-12 rounded-full bg-[#B3432E]/10 text-[#B3432E] flex items-center justify-center mx-auto text-xl font-bold font-mono">
        403
      </div>
      <div>
        <h2 className="text-xl font-semibold text-[#16233B]">Access Restricted</h2>
        <p className="text-sm text-[#5B6B79] mt-1">
          Your account does not possess the requisite clearance:
        </p>
        <code className="block mt-2 px-2.5 py-1.5 bg-[#F6F5F1] border border-[#D8D3C7] rounded text-xs font-mono text-[#B3432E]">
          {missingPermission}
        </code>
      </div>
      <div className="pt-2 flex justify-center gap-3">
        <Button variant="secondary" onClick={() => window.history.back()}>
          Return Back
        </Button>
        <Button variant="destructive" onClick={onLogout}>
          Sign Out
        </Button>
      </div>
    </Card>
  </div>
);