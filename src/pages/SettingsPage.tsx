import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiKey, setApiKey, exportData, importData, resetQuota } from '../lib/storage';
import QuotaIndicator from '../components/QuotaIndicator';

export default function SettingsPage() {
  const navigate = useNavigate();
  const [key, setKey] = useState(getApiKey);
  const [saved, setSaved] = useState(false);
  const [importError, setImportError] = useState('');
  const [quotaRefresh, setQuotaRefresh] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  function saveKey() {
    setApiKey(key.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function handleExport() {
    const blob = new Blob([exportData()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'baretube-backup.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        importData(ev.target!.result as string);
        setKey(getApiKey());
        setImportError('');
        alert('Import successful!');
      } catch {
        setImportError('Invalid backup file.');
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="page">
      <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>
      <h2 className="page-title">Settings</h2>

      <section className="settings-section">
        <h3 className="settings-heading">YouTube API Key</h3>
        <p className="settings-hint">
          Get a free key at{' '}
          <a href="https://console.developers.google.com" target="_blank" rel="noopener noreferrer">
            Google Cloud Console
          </a>
          {' '}— enable the YouTube Data API v3.
        </p>
        <input
          type="password"
          className="key-input"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="AIza..."
          autoComplete="off"
        />
        <button className="save-btn" onClick={saveKey}>
          {saved ? 'Saved!' : 'Save Key'}
        </button>
      </section>

      <section className="settings-section">
        <h3 className="settings-heading">API Quota</h3>
        <QuotaIndicator refresh={quotaRefresh} />
        <button className="secondary-btn" onClick={() => { resetQuota(); setQuotaRefresh((n) => n + 1); }}>
          Reset Quota Counter
        </button>
      </section>

      <section className="settings-section">
        <h3 className="settings-heading">Data</h3>
        <div className="btn-row">
          <button className="secondary-btn" onClick={handleExport}>Export Backup</button>
          <button className="secondary-btn" onClick={() => fileRef.current?.click()}>Import Backup</button>
        </div>
        <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
        {importError && <p className="error-msg">{importError}</p>}
      </section>
    </div>
  );
}
