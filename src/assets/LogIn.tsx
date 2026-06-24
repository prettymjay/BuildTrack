import React, { useState } from "react";
import "./LogIn.css";
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { requestPasswordReset, resetPassword } from '../services/auth';

function LogIn(): JSX.Element {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetUsername, setResetUsername] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { login: ctxLogin } = useAuth();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = await ctxLogin(email, password, remember);
    if (!res.success) {
      setError(res.error ?? 'Login failed');
      return;
    }
    navigate('/dashboard');
    return;
  };

  const onRequestReset = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setResetMessage(null);
    const res = await requestPasswordReset(resetUsername || email);
    if (!res.success) {
      setResetMessage(res.error ?? 'Unable to create reset code');
      return;
    }
    setResetMessage(`Reset code created. Use token: ${res.resetToken}`);
  };

  const onResetPassword = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setResetMessage(null);
    if (resetNewPassword !== resetConfirm) {
      setResetMessage('Passwords do not match');
      return;
    }
    const res = await resetPassword(resetUsername || email, resetToken, resetNewPassword);
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
      <form className="login-card" onSubmit={onSubmit} aria-label="Login form">
        <div className="card-top" />
        <h1 className="brand">ProBuild Hardware</h1>
        <div className="subtitle">ADMIN CONSOLE</div>

        <label className="field-label">USERNAME OR EMAIL</label>
        <div className="input-row">
          <span className="icon">👤</span>
          <input
            type="text"
            placeholder="Enter your credentials"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label="username or email"
            required
          />
        </div>

        <label className="field-label">PASSWORD</label>
        <div className="input-row">
          <span className="icon">🔒</span>
          <input
            type={showPassword ? "text" : "password"}
            placeholder=""
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
            {showPassword ? "🙈" : "👁️"}
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
          <button type="button" className="forgot" onClick={() => setResetMode((current) => !current)}>Forgot Password?</button>
        </div>

        {error && <div className="error">{error}</div>}
        <button className="primary-btn" type="submit">Login to Dashboard →</button>

        {resetMode && (
          <div className="reset-panel">
            <div className="reset-title">Password recovery</div>
            <div className="reset-form">
              <input
                type="text"
                placeholder="Username for reset"
                value={resetUsername || email}
                onChange={(event) => setResetUsername(event.target.value)}
              />
              <button type="button" className="secondary-btn" onClick={onRequestReset}>Generate Reset Code</button>
            </div>
            <div className="reset-form">
              <input
                type="text"
                placeholder="Reset token"
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
            {resetMessage && <div className="reset-message">{resetMessage}</div>}
          </div>
        )}

        <hr className="divider" />

        <div className="footer-note">Secure Access. Internal ProBuild Systems only.</div>

        <div className="footer-icons">
          <span className="support">🛈 SUPPORT</span>
          <span className="enc">🔒 ENCRYPTED</span>
        </div>
      </form>
    </div>
  );
}

export default LogIn;
