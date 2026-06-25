import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import './Reports.css';
import { formatPesoValue } from '../utils/formatCurrency';
import { authFetch } from '../services/auth';

type ReportRow = {
  id: number;
  date: string;
  ref: string;
  project: string;
  category: string;
  amount: number;
  status: string;
  description: string;
};

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';

const periodLabels = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly (Current)',
  quarterly: 'Quarterly',
} as const;

function downloadText(filename: string, contents: string) {
  const blob = new Blob([contents], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const escapes: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return escapes[character] || character;
  });
}

function withinPeriod(date: string, period: keyof typeof periodLabels) {
  if (!date) return false;
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return false;
  const now = new Date();
  const diffDays = (now.getTime() - value.getTime()) / (1000 * 60 * 60 * 24);
  if (period === 'daily') return diffDays <= 1;
  if (period === 'weekly') return diffDays <= 7;
  if (period === 'monthly') return value.getMonth() === now.getMonth() && value.getFullYear() === now.getFullYear();
  const currentQuarter = Math.floor(now.getMonth() / 3);
  const valueQuarter = Math.floor(value.getMonth() / 3);
  return valueQuarter === currentQuarter && value.getFullYear() === now.getFullYear();
}

function Reports() {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'quarterly'>('monthly');
  const [project, setProject] = useState('All Active Projects');
  const [category, setCategory] = useState('All Categories');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [selectedReport, setSelectedReport] = useState<ReportRow | null>(null);

  useEffect(() => {
    void loadReports();
  }, []);

  async function loadReports() {
    try {
      const response = await authFetch(`${API_BASE}/api/expenses?page=1&perPage=500`);
      const json = await response.json();
      const mapped = (json.data || []).map((row: any) => ({
        id: row.id,
        date: row.date || '',
        ref: `EXP-${String(row.id).padStart(4, '0')}`,
        project: row.project || 'Unassigned',
        category: row.category || 'Other',
        amount: Number(row.amount || 0) / 100,
        status: row.status || 'Recorded',
        description: row.description || '',
      }));
      setRows(mapped);
    } catch (error) {
      console.error(error);
    }
  }

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesQuery =
        !normalizedQuery ||
        [row.date, row.ref, row.project, row.category, row.status, row.description]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);
      const matchesProject = project === 'All Active Projects' || row.project === project;
      const matchesCategory = category === 'All Categories' || row.category === category;
      return matchesQuery && matchesProject && matchesCategory && withinPeriod(row.date, period);
    });
  }, [category, period, project, query, rows]);

  const projectOptions = useMemo(() => ['All Active Projects', ...Array.from(new Set(rows.map((row) => row.project))).sort()], [rows]);
  const categoryOptions = useMemo(() => ['All Categories', ...Array.from(new Set(rows.map((row) => row.category))).sort()], [rows]);

  const categoryTotals = useMemo(() => {
    return filteredRows.reduce<Record<string, number>>((acc, row) => {
      acc[row.category] = (acc[row.category] || 0) + row.amount;
      return acc;
    }, {});
  }, [filteredRows]);

  const periodTotals = useMemo(() => {
    const total = filteredRows.reduce((sum, row) => sum + row.amount, 0);
    const labor = categoryTotals.Labor || 0;
    const logistics = (categoryTotals.Transportation || 0) + (categoryTotals.Fuel || 0);
    const remaining = total - labor - logistics;
    return { total, labor, logistics, remaining };
  }, [categoryTotals, filteredRows]);

  function handleDownloadAll() {
    const header = ['Date', 'Reference', 'Project', 'Category', 'Amount', 'Status', 'Description'];
    const lines = filteredRows.map((row) => [
      row.date,
      row.ref,
      row.project,
      row.category,
      row.amount.toFixed(2),
      row.status,
      row.description,
    ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','));
    downloadText(`buildtrack-reports-${period}.csv`, [header.join(','), ...lines].join('\n'));
  }

  function handleDownloadRow(row: ReportRow) {
    const csv = [
      ['Date', 'Reference', 'Project', 'Category', 'Amount', 'Status', 'Description'].join(','),
      [row.date, row.ref, row.project, row.category, row.amount.toFixed(2), row.status, row.description]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(','),
    ].join('\n');
    downloadText(`report-${row.ref}.csv`, csv);
  }

  function handlePrintView() {
    if (!selectedReport) return;
    const reportWindow = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
    if (!reportWindow) return;
    reportWindow.document.write(`
      <html>
        <head>
          <title>Report ${escapeHtml(selectedReport.ref)}</title>
          <style>
            body{font-family:Arial,sans-serif;padding:32px;color:#0f1724}
            .meta{color:#64748b;margin-bottom:20px}
            .card{border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-top:16px}
            .row{display:flex;justify-content:space-between;gap:16px;padding:8px 0;border-bottom:1px solid #eef2f7}
            .row:last-child{border-bottom:0}
            .label{color:#64748b}
          </style>
        </head>
        <body>
          <h1>Financial Report</h1>
          <div class="meta">${escapeHtml(periodLabels[period])} view</div>
          <div class="card">
            <div class="row"><span class="label">Reference</span><strong>${escapeHtml(selectedReport.ref)}</strong></div>
            <div class="row"><span class="label">Date</span><strong>${escapeHtml(selectedReport.date)}</strong></div>
            <div class="row"><span class="label">Project</span><strong>${escapeHtml(selectedReport.project)}</strong></div>
            <div class="row"><span class="label">Category</span><strong>${escapeHtml(selectedReport.category)}</strong></div>
            <div class="row"><span class="label">Amount</span><strong>${escapeHtml(formatPesoValue(selectedReport.amount))}</strong></div>
            <div class="row"><span class="label">Status</span><strong>${escapeHtml(selectedReport.status)}</strong></div>
            <div class="row"><span class="label">Description</span><strong>${escapeHtml(selectedReport.description || '-')}</strong></div>
          </div>
        </body>
      </html>
    `);
    reportWindow.document.close();
    reportWindow.focus();
    reportWindow.print();
  }

  return (
    <>
      <Sidebar />
      <main className="main reports-root">
        <div className="reports-header">
          <div>
            <h1 className="reports-title">Financial Reports</h1>
            <div className="reports-sub">Detailed analysis of project expenditures and resource allocation.</div>
          </div>
          <div className="reports-actions">
            <div className="search-wrap">
              <input
                className="search-input"
                placeholder="Search reports..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <button className="icon-btn small" type="button" aria-label="Search reports">Search</button>
            </div>
            <button className="btn add-primary" type="button" onClick={handleDownloadAll}>Download CSV</button>
          </div>
        </div>

        <div className="filters-row">
          <select className="filter" value={period} onChange={(event) => setPeriod(event.target.value as typeof period)}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly (Current)</option>
            <option value="quarterly">Quarterly</option>
          </select>
          <select className="filter" value={project} onChange={(event) => setProject(event.target.value)}>
            {projectOptions.map((option) => <option key={option}>{option}</option>)}
          </select>
          <select className="filter" value={category} onChange={(event) => setCategory(event.target.value)}>
            {categoryOptions.map((option) => <option key={option}>{option}</option>)}
          </select>
          <button className="btn apply" type="button" onClick={loadReports}>Refresh Data</button>
        </div>

        <div className="summary-cards">
          <div className="card stat">
            <div className="label">TOTAL LABOR COST</div>
            <div className="value">{formatPesoValue(periodTotals.labor)}</div>
            <div className="delta">Filtered period</div>
          </div>
          <div className="card stat">
            <div className="label">TRANSPORT + FUEL</div>
            <div className="value">{formatPesoValue(periodTotals.logistics)}</div>
            <div className="delta">{filteredRows.length} records</div>
          </div>
          <div className="card stat highlight">
            <div className="label">GRAND TOTAL (SELECTED PERIOD)</div>
            <div className="value large">{formatPesoValue(periodTotals.total)}</div>
            <div className="badge">{formatPesoValue(periodTotals.remaining)} other costs</div>
          </div>
        </div>

        <div className="charts-row">
          <div className="chart card">
            <div className="card-title">{periodLabels[period]} Expense Trends</div>
            <div className="chart-placeholder">{filteredRows.length === 0 ? 'No report data yet' : `${filteredRows.length} records in this view`}</div>
          </div>
          <div className="card small-right">
            <div className="card-title">Allocation by Category</div>
            <div className="alloc-placeholder">
              {Object.keys(categoryTotals).length === 0 ? '0%' : 'Live'}
              <div className="muted">Category totals</div>
              <div className="alloc-list">
                {Object.entries(categoryTotals).map(([name, amount]) => (
                  <div key={name}>{name} <span>{formatPesoValue(amount)}</span></div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="report-table card">
          <div className="table-top">
            <div className="table-title">Report Breakdown</div>
            <button className="view-all" type="button" onClick={handleDownloadAll}>DOWNLOAD CURRENT VIEW</button>
          </div>
          <table>
            <thead>
              <tr>
                <th>DATE</th>
                <th>REFERENCE #</th>
                <th>PROJECT NAME</th>
                <th>CATEGORY</th>
                <th>AMOUNT</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr><td colSpan={7}>No reports available for the selected filters.</td></tr>
              ) : filteredRows.map((row) => (
                <tr key={row.ref}>
                  <td>{row.date}</td>
                  <td className="mono">{row.ref}</td>
                  <td>{row.project}</td>
                  <td><span className="tag small">{row.category}</span></td>
                  <td className="text-right">{formatPesoValue(row.amount)}</td>
                  <td><span className={`status ${row.status.toLowerCase().replace(/\s+/g, '-')}`}>{row.status}</span></td>
                  <td className="row-actions">
                    <button type="button" className="row-btn" onClick={() => setSelectedReport(row)}>View</button>
                    <button type="button" className="row-btn secondary" onClick={() => handleDownloadRow(row)}>Download</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="table-footer muted">Showing 1 to {filteredRows.length} of {filteredRows.length} reports</div>
        </div>

        {selectedReport && (
          <div className="report-modal-backdrop" onClick={() => setSelectedReport(null)}>
            <div className="report-modal" onClick={(event) => event.stopPropagation()}>
              <div className="report-modal-header">
                <div>
                  <div className="report-modal-kicker">Report Preview</div>
                  <h2>{selectedReport.ref}</h2>
                </div>
                <button className="close-report" type="button" onClick={() => setSelectedReport(null)}>X</button>
              </div>
              <div className="report-modal-grid">
                <div><span>Date</span><strong>{selectedReport.date}</strong></div>
                <div><span>Project</span><strong>{selectedReport.project}</strong></div>
                <div><span>Category</span><strong>{selectedReport.category}</strong></div>
                <div><span>Status</span><strong>{selectedReport.status}</strong></div>
                <div><span>Amount</span><strong>{formatPesoValue(selectedReport.amount)}</strong></div>
                <div><span>Period</span><strong>{periodLabels[period]}</strong></div>
              </div>
              <div className="report-modal-actions">
                <button type="button" className="btn apply" onClick={handlePrintView}>View / Print</button>
                <button type="button" className="btn add-primary" onClick={() => handleDownloadRow(selectedReport)}>Download CSV</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

export default Reports;
