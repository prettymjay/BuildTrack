import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import './Settings.css';
import { authFetch } from '../services/auth';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('profile');
  const [company, setCompany] = useState({
    name: 'ProBuild Global Solutions',
    address: '1200 Industrial Way, Suite 400,\nChicago, IL 60601,\nUnited States',
    contact: '+1 (555) 0123-4567',
    email: 'admin@probuild.com'
  });
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [adminCreds, setAdminCreds] = useState({ username: 'admin', password: '', confirm: '' });
  const [credMsg, setCredMsg] = useState<string | null>(null);
  const [credBusy, setCredBusy] = useState(false);

  async function readErrorMessage(response: Response) {
    try {
      const json = await response.json();
      return json?.error || 'Request failed';
    } catch {
      return 'Request failed';
    }
  }

  async function handleCreateBackup() {
    setBackupBusy(true);
    setBackupStatus('Creating backup...');
    try {
      const response = await authFetch(`${API_BASE}/api/backup`, { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        setBackupStatus(`Backup created: ${data.file}`);
      } else {
        setBackupStatus(await readErrorMessage(response));
      }
    } catch {
      setBackupStatus('Network error');
    } finally {
      setBackupBusy(false);
    }
  }

  async function handleDownloadLatest() {
    setBackupBusy(true);
    setBackupStatus('Preparing latest backup download...');
    try {
      const response = await authFetch(`${API_BASE}/api/backup/download`);
      if (!response.ok) {
        setBackupStatus(await readErrorMessage(response));
        return;
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('content-disposition') || '';
      const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
      const filename = filenameMatch?.[1] || 'latest-backup.db';
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      setBackupStatus(`Downloaded ${filename}`);
    } catch {
      setBackupStatus('Network error');
    } finally {
      setBackupBusy(false);
    }
  }

  async function handleCleanup() {
    setBackupBusy(true);
    setBackupStatus('Running cleanup...');
    try {
      const response = await authFetch(`${API_BASE}/api/backup/cleanup?days=30`, { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        setBackupStatus(`Cleanup completed. Removed ${data.removed} old backups.`);
      } else {
        setBackupStatus(await readErrorMessage(response));
      }
    } catch {
      setBackupStatus('Network error');
    } finally {
      setBackupBusy(false);
    }
  }

  async function handleSaveCredentials() {
    setCredMsg(null);
    if (adminCreds.password !== adminCreds.confirm) {
      setCredMsg('Passwords do not match');
      return;
    }

    setCredBusy(true);
    try {
      const response = await authFetch(`${API_BASE}/api/admin/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: adminCreds.username, password: adminCreds.password }),
      });

      if (response.ok) {
        setCredMsg('Credentials updated');
        setAdminCreds((current) => ({ ...current, password: '', confirm: '' }));
      } else {
        setCredMsg(await readErrorMessage(response));
      }
    } catch {
      setCredMsg('Network error');
    } finally {
      setCredBusy(false);
    }
  }

  return (
    <>
      <Sidebar />
      <main className="main settings-root">
        <div className="settings-header">
          <h1>System Configuration</h1>
          <div className="settings-sub">Manage company details, user access permissions, and core system security protocols.</div>
        </div>

        <div className="settings-card card">
          <div className="tabs">
            <button className={`tab ${activeTab==='profile'?'active':''}`} onClick={()=>setActiveTab('profile')}>Company Profile</button>
            <button className={`tab ${activeTab==='users'?'active':''}`} onClick={()=>setActiveTab('users')}>User Management</button>
            <button className={`tab ${activeTab==='security'?'active':''}`} onClick={()=>setActiveTab('security')}>System & Security</button>
          </div>

          {activeTab === 'profile' && (
            <div className="profile-grid">
              <div className="branding">
                <div className="branding-title">Corporate Branding</div>
                <div className="branding-sub">This logo will appear on all generated invoices, reports, and purchase orders.</div>
                <div className="upload-box"> 
                  <div className="upload-icon">📎</div>
                  <div className="upload-text">Upload Company Logo<br/><span className="muted">PNG, JPG up to 5MB</span></div>
                </div>
              </div>

              <div className="company-form">
                <label>Company Name
                  <input value={company.name} onChange={e=>setCompany({...company, name:e.target.value})} />
                </label>
                <label>Registered Address
                  <textarea value={company.address} onChange={e=>setCompany({...company, address:e.target.value})} rows={4} />
                </label>

                <div className="row">
                  <label>Contact Number
                    <input value={company.contact} onChange={e=>setCompany({...company, contact:e.target.value})} />
                  </label>
                  <label>Email Address
                    <input value={company.email} onChange={e=>setCompany({...company, email:e.target.value})} />
                  </label>
                </div>

                <div className="actions">
                  <button className="btn btn-primary">Save Changes</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="users-panel">
              <h3>Admin Credentials</h3>
              <div className="admin-form">
                <label>Username
                  <input value={adminCreds.username} onChange={e=>setAdminCreds({...adminCreds, username: e.target.value})} />
                </label>
                <label>New Password
                  <input type="password" value={adminCreds.password} onChange={e=>setAdminCreds({...adminCreds, password: e.target.value})} />
                </label>
                <label>Confirm Password
                  <input type="password" value={adminCreds.confirm} onChange={e=>setAdminCreds({...adminCreds, confirm: e.target.value})} />
                </label>
                <div className="settings-actions">
                  <button className="btn btn-secondary" type="button" onClick={()=>{ setAdminCreds({username:'admin', password:'', confirm:''}); setCredMsg(null);}}>Reset</button>
                  <button className="btn btn-primary" type="button" onClick={handleSaveCredentials} disabled={credBusy}>{credBusy ? 'Saving...' : 'Save Credentials'}</button>
                </div>
                {credMsg && <div className="muted" style={{marginTop:8}}>{credMsg}</div>}
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="security-panel">
              <h3>Backup & Maintenance</h3>
              <div className="backup-box">
                <div className="backup-copy">
                  <div className="backup-title">Keep a local database snapshot, download the latest backup, and clear old files.</div>
                  <div className="backup-sub muted">These actions talk to the server backup endpoints directly.</div>
                </div>
                <div className="backup-actions">
                  <button className="btn" type="button" onClick={handleCreateBackup} disabled={backupBusy}>Create Backup</button>
                  <button className="btn" type="button" onClick={handleDownloadLatest} disabled={backupBusy}>Download Latest</button>
                  <button className="btn" type="button" onClick={handleCleanup} disabled={backupBusy}>Run Cleanup</button>
                </div>
                {backupStatus && <div className="muted" style={{marginTop:8}}>{backupStatus}</div>}
              </div>
            </div>
          )}
        </div>

        <footer className="settings-foot muted">SYSTEM BUILD V4.2.1-STABLE</footer>
      </main>
    </>
  )
}
