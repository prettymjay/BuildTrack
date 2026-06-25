import { useState } from "react";
import "./LogIn.css";
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { requestPasswordReset, resetPassword } from '../services/auth';

function LogIn() {
  const [credential, setCredential] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const { login: ctxLogin } = useAuth();

  const onSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setError(null);
    const res = await ctxLogin(credential, password, remember);
    if (!res.success) {
      setError(res.error ?? 'Login failed');
      return;
    }
    navigate('/dashboard');
  };

  const onRequestReset = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setResetMessage(null);
    if (!resetEmail.trim()) {
      setResetMessage('Enter the email address for your account');
      return;
    }

    const res = await requestPasswordReset(resetEmail);
    if (!res.success) {
      setResetMessage(res.error ?? 'Unable to create reset code');
      return;
    }
    setResetMessage(res.message ?? `Reset code sent. It expires in ${res.expiresInMinutes ?? 15} minutes.`);
  };

  const onResetPassword = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setResetMessage(null);
    if (resetNewPassword !== resetConfirm) {
      setResetMessage('Passwords do not match');
      return;
    }

    const res = await resetPassword(resetEmail, resetToken, resetNewPassword);
    if (!res.success) {
      setResetMessage(res.error ?? 'Reset failed');
      return;
    }

    setResetMessage('Password updated. You can log in now.');
    setResetMode(false);
    setResetToken('');
    setResetNewPassword('');
    setResetConfirm('');
  };

  return (
    <div className="login-page">
      <div className={`login-shell ${resetMode ? 'recovery-open' : ''}`}>
        <form className="login-card" onSubmit={onSubmit} aria-label="Login form">
          <div className="card-top" />
          <h1 className="brand">ProBuild Hardware</h1>
          <div className="subtitle">ADMIN CONSOLE</div>

        <label className="field-label">USERNAME OR EMAIL</label>
        <div className="input-row">
          <span className="icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 7a6 6 0 0 1 12 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <input
            type="text"
            placeholder="Enter your credentials"
              value={credential}
              onChange={(e) => setCredential(e.target.value)}
              aria-label="username or email"
              required
            />
          </div>

        <label className="field-label">PASSWORD</label>
        <div className="input-row">
          <span className="icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M12 15v2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>
          <input
            type={showPassword ? "text" : "password"}
            value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-label="password"
              required
            />
            <button
              type="button"
              className="show-btn"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          <div className="row-between">
            <label className="remember">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span>Remember device</span>
            </label>
            <button type="button" className="forgot" onClick={() => setResetMode((current) => !current)}>
              {resetMode ? 'Close recovery' : 'Forgot Password or Username?'}
            </button>
          </div>

          {error && <div className="error">{error}</div>}
          <button className="primary-btn" type="submit">Login to Dashboard -&gt;</button>

          <hr className="divider" />

          <div className="footer-note">Secure Access. Internal ProBuild Systems only.</div>

          <div className="footer-icons">
            <span className="support">Support</span>
            <span className="enc">Encrypted</span>
          </div>
        </form>

        {resetMode && (
          <aside className="recovery-card">
            <div className="recovery-card-top" />
            <div className="reset-title">Account recovery</div>
            <div className="reset-copy">Enter the Gmail saved in Settings and we&apos;ll email your username and reset code there.</div>
            <div className="reset-form">
              <input
                type="email"
                placeholder="Email address"
                value={resetEmail}
                onChange={(event) => setResetEmail(event.target.value)}
              />
              <button type="button" className="secondary-btn" onClick={onRequestReset}>Send Reset Code</button>
            </div>
            <div className="reset-form">
              <input
                type="text"
                placeholder="Code from your email"
                value={resetToken}
                onChange={(event) => setResetToken(event.target.value)}
              />
              <input
                type="password"
                placeholder="New password"
                value={resetNewPassword}
                onChange={(event) => setResetNewPassword(event.target.value)}
              />
              <input
                type="password"
                placeholder="Confirm new password"
                value={resetConfirm}
                onChange={(event) => setResetConfirm(event.target.value)}
              />
              <button type="button" className="secondary-btn" onClick={onResetPassword}>Reset Password</button>
            </div>
            {resetMessage && <div className="reset-message status">{resetMessage}</div>}
          </aside>
        )}
      </div>
    </div>
  );
}

export default LogIn;
