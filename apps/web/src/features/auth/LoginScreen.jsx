import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { Button, Input, Card } from '@repo/ui';

export default function LoginScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, verify2FA } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 2FA states matching backend contract
  const [step, setStep] = useState('CREDENTIALS'); // 'CREDENTIALS' | '2FA'
  const [challengeToken, setChallengeToken] = useState('');
  const [code, setCode] = useState('');
  const [isEnrolled, setIsEnrolled] = useState(true);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [manualSecret, setManualSecret] = useState('');

  const redirectPath = location.state?.from?.pathname || '/dashboard';

  const handleCredentialsSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const result = await login(email, password);
      if (result.requires2FA) {
        setChallengeToken(result.challengeToken);
        setIsEnrolled(result.isEnrolled);
        setQrCodeUrl(result.qrCodeUrl || '');
        setManualSecret(result.secret || '');
        setStep('2FA');
      } else {
        navigate(redirectPath, { replace: true });
      }
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handle2FASubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      await verify2FA(challengeToken, code, isEnrolled);
      navigate(redirectPath, { replace: true });
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F5F1] flex items-center justify-center p-4">
      <div className="w-full max-w-[440px] space-y-6">
        <div className="text-center space-y-1">
          <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-mono tracking-widest uppercase bg-[#B9812E]/10 text-[#B9812E] font-semibold">
            Workforce Portal
          </span>
          <h1 className="text-2xl font-bold text-[#16233B]">Enterprise System Login</h1>
        </div>

        <Card className="p-8 shadow-[0_4px_16px_rgba(22,35,59,0.06)] border border-[#D8D3C7]">
          {errorMessage && (
            <div className="mb-5 p-3 rounded-[6px] bg-[#B3432E]/10 border border-[#B3432E]/20 text-[#B3432E] text-xs font-medium">
              {errorMessage}
            </div>
          )}

          {step === 'CREDENTIALS' ? (
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <Input
                label="Email Address"
                type="email"
                required
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />

              <Input
                label="Password"
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />

              <Button
                type="submit"
                variant="primary"
                className="w-full mt-2"
                isLoading={isSubmitting}
              >
                Sign In
              </Button>
            </form>
          ) : (
            <form onSubmit={handle2FASubmit} className="space-y-5">
              <div className="text-center">
                <h3 className="text-base font-semibold text-[#16233B]">
                  Two-Factor Authentication
                </h3>
                <p className="text-xs text-[#5B6B79] mt-1">
                  {!isEnrolled
                    ? 'Scan the QR code below into Google Authenticator or enter the secret key.'
                    : 'Enter the 6-digit code from your authenticator application.'}
                </p>
              </div>

              {/* First-time Enrollment Box */}
              {!isEnrolled && (
                <div className="p-4 bg-[#F6F5F1] border border-[#D8D3C7] rounded-[8px] text-center space-y-3">
                  <span className="text-xs font-semibold text-[#16233B]">
                    Scan QR Code to Enroll
                  </span>
                  {qrCodeUrl && (
                    <img
                      src={qrCodeUrl}
                      alt="2FA QR Code"
                      className="w-40 h-40 mx-auto border border-[#D8D3C7] rounded p-1 bg-white"
                    />
                  )}
                  {manualSecret && (
                    <div className="space-y-1">
                      <span className="text-[11px] text-[#5B6B79]">Manual Key:</span>
                      <code className="block font-mono text-xs text-[#16233B] bg-white p-1 border border-[#D8D3C7] rounded select-all break-all">
                        {manualSecret}
                      </code>
                    </div>
                  )}
                </div>
              )}

              <Input
                label="Authentication Code"
                type="text"
                required
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                isNumeric
                autoFocus
              />

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="w-1/3"
                  onClick={() => {
                    setStep('CREDENTIALS');
                    setErrorMessage('');
                  }}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="w-2/3"
                  isLoading={isSubmitting}
                >
                  Verify Code
                </Button>
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}