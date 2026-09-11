import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth, resolveHomeRoute } from '../../context/AuthContext.jsx';

export default function LoginScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, verify2FA } = useAuth();

  // Primary Credentials Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // 2FA Challenge State
  const [is2FAChallenge, setIs2FAChallenge] = useState(false);
  const [challengeToken, setChallengeToken] = useState('');
  const [totpCode, setTotpCode] = useState('');

  // Status & Telemetry
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Target return route if redirected by ProtectedRoute
  const returnTo = location.state?.from?.pathname;

  // 1. Handle Primary Authentication Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      const sanitizedEmail = email.trim().toLowerCase();
      const res = await login(sanitizedEmail, password, rememberMe);

      // Multi-Factor Authentication Challenge Intercept
      if (res?.requires2FA) {
        setChallengeToken(res.challengeToken);
        setIs2FAChallenge(true);
        setLoading(false);
        return;
      }

      // Dynamic Role-Based Landing Resolution
      const targetDestination = returnTo || res?.homeRoute || resolveHomeRoute(res?.user);
      navigate(targetDestination, { replace: true });
    } catch (err) {
      console.error('Authentication Error:', err);
      setErrorMessage(
        err.response?.data?.message ||
        err.message ||
        'Invalid organization email or password credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  // 2. Handle 2FA Verification Submission
  const handleVerify2FA = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      const user = await verify2FA(challengeToken, totpCode);
      const targetDestination = returnTo || resolveHomeRoute(user);
      navigate(targetDestination, { replace: true });
    } catch (err) {
      console.error('2FA Verification Error:', err);
      setErrorMessage(
        err.response?.data?.message || 'Invalid or expired multi-factor authentication code.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-[#F7F6F2] flex items-center justify-center p-4 font-sans text-[#16233B] selection:bg-[#B9812E]/20">
      <div className="w-full max-w-[460px] bg-white rounded-lg border border-[#D8D3C7] shadow-sm overflow-hidden relative">
        {/* Top Metallic Border Accent */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#16233B] via-[#B9812E] to-[#16233B]" />

        <div className="p-8 sm:p-10 space-y-6">
          {/* Header & Secure Lock Badge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded bg-[#16233B] text-white flex items-center justify-center shadow-xs">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 1L2 6v2h20V6L12 1zm-7 9v8h2v-8H5zm5 0v8h2v-8h-2zm5 0v8h2v-8h-2zm5 0v8h2v-8h-2zM2 20v2h20v-2H2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xs font-bold tracking-wider font-mono uppercase text-[#16233B] leading-none">
                  LEGACY LEDGER
                </h2>
                <span className="text-[10px] font-mono text-[#5B6B79] uppercase tracking-wider block mt-1">
                  HR PLATFORM
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#FAF9F6] border border-[#EAE7DF] text-[11px] font-mono text-[#5B6B79]">
              <svg className="w-3.5 h-3.5 text-[#B9812E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>// SECURE AUTH</span>
            </div>
          </div>

          {/* Page Title & Subtitle */}
          <div className="space-y-1 pt-1">
            <h1 className="text-2xl font-bold tracking-tight text-[#16233B]">
              {is2FAChallenge ? 'Two-Factor Verification' : 'Sign In to Workspace'}
            </h1>
            <p className="text-xs text-[#5B6B79] leading-relaxed">
              {is2FAChallenge
                ? 'Enter the 6-digit TOTP verification code from your authenticator app.'
                : 'Enter your registered organization email and password to access your portal.'}
            </p>
          </div>

          {/* Informational Notice */}
          <div className="p-3.5 bg-[#FFFDF5] border border-[#EBD6A7] rounded-md flex items-start gap-3">
            <svg className="w-4 h-4 text-[#B9812E] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <p className="text-[11px] font-mono text-[#6E5420] leading-snug">
              Multi-factor challenge may be prompted for external network sessions.
            </p>
          </div>

          {/* Error Message Notice */}
          {errorMessage && (
            <div className="p-3 bg-[#B3432E]/10 border border-[#B3432E]/30 rounded text-xs font-mono text-[#B3432E]">
              ⚠️ {errorMessage}
            </div>
          )}

          {/* Stage A: Standard Credentials Form */}
          {!is2FAChallenge ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Work Email */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-mono font-semibold uppercase text-[#5B6B79]">
                  WORK EMAIL
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-[#5B6B79]">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@organization.com"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-[#D8D3C7] rounded-md text-xs text-[#16233B] placeholder-[#9E9B93] focus:outline-none focus:border-[#B9812E] focus:ring-1 focus:ring-[#B9812E] transition-all font-mono"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-mono font-semibold uppercase text-[#5B6B79]">
                    PASSWORD
                  </label>
                  <button
                    type="button"
                    onClick={() => alert('Password reset verification email will be dispatched.')}
                    className="text-xs font-medium text-[#B9812E] hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-[#5B6B79]">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-10 py-2.5 bg-white border border-[#D8D3C7] rounded-md text-xs text-[#16233B] placeholder-[#9E9B93] focus:outline-none focus:border-[#B9812E] focus:ring-1 focus:ring-[#B9812E] transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 text-[#5B6B79] hover:text-[#16233B] cursor-pointer"
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  id="remember"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-[#D8D3C7] text-[#B9812E] focus:ring-[#B9812E] cursor-pointer"
                />
                <label htmlFor="remember" className="text-xs text-[#5B6B79] cursor-pointer select-none">
                  Keep me signed in on this device (30 days)
                </label>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 bg-[#B9812E] hover:bg-[#a57227] active:scale-[0.99] text-white text-xs font-mono font-semibold rounded-md shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <span>{loading ? 'Authenticating Enclave...' : 'Sign In'}</span>
                {!loading && <span>&rarr;</span>}
              </button>
            </form>
          ) : (
            /* Stage B: 2FA Challenge Form */
            <form onSubmit={handleVerify2FA} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-mono font-semibold uppercase text-[#5B6B79]">
                  AUTHENTICATOR TOTP CODE (6-DIGIT)
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  autoFocus
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full text-center tracking-[0.5em] py-3 bg-[#FAF9F6] border border-[#D8D3C7] rounded-md text-lg font-mono font-bold text-[#16233B] focus:outline-none focus:border-[#B9812E]"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIs2FAChallenge(false);
                    setTotpCode('');
                    setErrorMessage('');
                  }}
                  className="w-1/3 py-2.5 px-3 bg-[#FAF9F6] border border-[#D8D3C7] text-xs font-mono text-[#5B6B79] rounded-md hover:bg-[#F2EFE9] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || totpCode.length < 6}
                  className="w-2/3 py-2.5 px-3 bg-[#B9812E] hover:bg-[#a57227] text-white text-xs font-mono font-semibold rounded-md shadow-sm cursor-pointer disabled:opacity-60"
                >
                  {loading ? 'Verifying...' : 'Verify & Continue'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}