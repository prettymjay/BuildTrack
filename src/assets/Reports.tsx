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

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');

const periodLabels = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly (Current)',
  quarterly: 'Quarterly',
} as const;

function formatReportDate(value: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: '2-digit',
  });
}

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

function isWithinDateRange(date: string, startDate: string, endDate: string) {
  if (!date) return false;
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return false;

  if (startDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    if (value < start) {
      return false;
    }
  }

  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    if (value > end) {
      return false;
    }
  }

  return true;
}

function groupLabelForPeriod(value: string, period: keyof typeof periodLabels) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  if (period === 'daily') {
    return date.toLocaleDateString('en-PH', { month: 'short', day: '2-digit' });
  }

  if (period === 'weekly') {
    return `Week of ${date.toLocaleDateString('en-PH', { month: 'short', day: '2-digit' })}`;
  }

  if (period === 'quarterly') {
    return `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
  }

  return date.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' });
}

function Reports() {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'quarterly'>('monthly');
  const [project, setProject] = useState('All Active Projects');
  const [category, setCategory] = useState('All Categories');
  const [reportDate, setReportDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [selectedReport, setSelectedReport] = useState<ReportRow | null>(null);
  const isDailyReport = period === 'daily';

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
      const matchesExactDate = !isDailyReport || !reportDate || row.date === reportDate;
      const matchesRange = isDailyReport ? true : isWithinDateRange(row.date, startDate, endDate);
      const matchesPeriod = isDailyReport
        ? (!reportDate ? withinPeriod(row.date, period) : true)
        : (startDate || endDate ? matchesRange : withinPeriod(row.date, period));
      return matchesQuery && matchesProject && matchesCategory && matchesExactDate && matchesPeriod;
    });
  }, [category, endDate, isDailyReport, period, project, query, reportDate, rows, startDate]);

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

  const trendRows = useMemo(() => {
    const groups = filteredRows.reduce<Record<string, number>>((acc, row) => {
      const label = reportDate || startDate || endDate
        ? formatReportDate(row.date)
        : groupLabelForPeriod(row.date, period);
      acc[label] = (acc[label] || 0) + row.amount;
      return acc;
    }, {});

    const entries = Object.entries(groups).map(([label, amount]) => ({ label, amount }));
    const max = Math.max(1, ...entries.map((entry) => entry.amount));
    return entries.map((entry) => ({
      ...entry,
      width: Math.max(12, Math.round((entry.amount / max) * 100)),
    }));
  }, [endDate, filteredRows, period, reportDate, startDate]);

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

  function handlePrintView(report = selectedReport) {
    if (!report) return;
    const reportWindow = window.open('', '_blank', 'width=900,height=700');
    if (!reportWindow) return;
    const periodText = isDailyReport && reportDate
      ? `Report date: ${formatReportDate(reportDate)}`
      : !isDailyReport && (startDate || endDate)
        ? `Range: ${startDate ? formatReportDate(startDate) : 'Beginning'} to ${endDate ? formatReportDate(endDate) : 'Latest'}`
        : periodLabels[period];

    reportWindow.document.open();
    reportWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Report ${escapeHtml(report.ref)}</title>
          <style>
            @page{size:auto;margin:18mm}
            *{box-sizing:border-box}
            body{font-family:Inter,Segoe UI,Arial,sans-serif;padding:32px;color:#0f1724;background:#f8fafc}
            .shell{max-width:860px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:20px;padding:32px}
            .heading{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;border-bottom:1px solid #eef2f7;padding-bottom:18px}
            .title{margin:0;font-size:30px;line-height:1.05}
            .meta{color:#64748b;margin-top:10px;font-size:14px}
            .summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:22px}
            .summary-card{border:1px solid #e5e7eb;border-radius:14px;padding:16px 18px;background:#fbfdff}
            .summary-label{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#64748b}
            .summary-value{display:block;margin-top:8px;font-size:22px;font-weight:800;color:#0f1724}
            .card{border:1px solid #e5e7eb;border-radius:16px;padding:22px;margin-top:18px}
            .section-title{margin:0 0 10px;font-size:18px}
            .row{display:flex;justify-content:space-between;gap:16px;padding:12px 0;border-bottom:1px solid #eef2f7}
            .row:last-child{border-bottom:0}
            .label{color:#64748b;font-size:13px;text-transform:uppercase;letter-spacing:.08em}
            .value{font-weight:700;text-align:right}
            .description{margin-top:18px;padding:16px 18px;border-radius:14px;background:#f8fafc;color:#334155;line-height:1.6}
            @media print{
              body{background:#fff;padding:0}
              .shell{border:none;border-radius:0;padding:0;max-width:none}
            }
            @media (max-width:700px){
              .summary{grid-template-columns:1fr}
              .heading,.row{flex-direction:column}
              .value{text-align:left}
            }
          </style>
        </head>
        <body>
          <div class="shell">
            <div class="heading">
              <div>
                <h1 class="title">Financial Report</h1>
                <div class="meta">ProBuild App financial export</div>
                <div class="meta">${escapeHtml(periodText)}</div>
              </div>
              <div class="meta">Reference ${escapeHtml(report.ref)}</div>
            </div>

            <div class="summary">
              <div class="summary-card">
                <span class="summary-label">Amount</span>
                <strong class="summary-value">${escapeHtml(formatPesoValue(report.amount))}</strong>
              </div>
              <div class="summary-card">
                <span class="summary-label">Project</span>
                <strong class="summary-value">${escapeHtml(report.project)}</strong>
              </div>
              <div class="summary-card">
                <span class="summary-label">Status</span>
                <strong class="summary-value">${escapeHtml(report.status)}</strong>
              </div>
            </div>

            <div class="card">
              <h2 class="section-title">Report Details</h2>
              <div class="row"><span class="label">Reference</span><span class="value">${escapeHtml(report.ref)}</span></div>
              <div class="row"><span class="label">Date</span><span class="value">${escapeHtml(formatReportDate(report.date))}</span></div>
              <div class="row"><span class="label">Project</span><span class="value">${escapeHtml(report.project)}</span></div>
              <div class="row"><span class="label">Category</span><span class="value">${escapeHtml(report.category)}</span></div>
              <div class="row"><span class="label">Period</span><span class="value">${escapeHtml(periodText)}</span></div>
              <div class="description"><strong>Description:</strong> ${escapeHtml(report.description || '-')}</div>
            </div>
          </div>
        </body>
      </html>
    `);
    reportWindow.document.close();
    window.setTimeout(() => {
      reportWindow.focus();
      reportWindow.print();
    }, 350);
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
          <label className="filter-field">
            <span className="filter-label">Report Type</span>
            <select className="filter-control" value={period} onChange={(event) => setPeriod(event.target.value as typeof period)}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly (Current)</option>
              <option value="quarterly">Quarterly</option>
            </select>
          </label>
          {isDailyReport ? (
            <label className="filter-field">
              <span className="filter-label">Report Date</span>
              <input
                type="date"
                className="filter-control date-filter"
                value={reportDate}
                onChange={(event) => setReportDate(event.target.value)}
                aria-label="Pick report date"
              />
            </label>
          ) : null}
          <label className="filter-field">
            <span className="filter-label">Project</span>
            <select className="filter-control" value={project} onChange={(event) => setProject(event.target.value)}>
              {projectOptions.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
          <label className="filter-field">
            <span className="filter-label">Category</span>
            <select className="filter-control" value={category} onChange={(event) => setCategory(event.target.value)}>
              {categoryOptions.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
          {!isDailyReport ? (
            <>
              <label className="filter-field date-range-field">
                <span className="filter-label">Start Date</span>
                <input
                  type="date"
                  className="filter-control date-filter"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  aria-label="Start date"
                />
              </label>
              <label className="filter-field date-range-field">
                <span className="filter-label">End Date</span>
                <input
                  type="date"
                  className="filter-control date-filter"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  aria-label="End date"
                />
              </label>
            </>
          ) : null}
          <div className="filter-actions">
            <button className="btn clear-filter" type="button" onClick={() => { setReportDate(''); setStartDate(''); setEndDate(''); }}>
              Clear Dates
            </button>
            <button className="btn apply" type="button" onClick={loadReports}>Refresh Data</button>
            <button className="btn add-primary" type="button" disabled={!selectedReport} onClick={() => { if (selectedReport) { handlePrintView(); } }}>
              Print Selected
            </button>
          </div>
        </div>

        <div className="summary-cards">
          <div className="card stat">
            <div className="label">TOTAL LABOR COST</div>
            <div className="value">{formatPesoValue(periodTotals.labor)}</div>
            <div className="delta">{reportDate || startDate || endDate ? 'Custom date selection' : 'Filtered period'}</div>
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
            <div className="card-title">{reportDate || startDate || endDate ? 'Custom Range Expense Trends' : `${periodLabels[period]} Expense Trends`}</div>
            {trendRows.length === 0 ? (
              <div className="chart-placeholder">No report data yet</div>
            ) : (
              <div className="trend-bars">
                {trendRows.map((entry) => (
                  <div key={entry.label} className="trend-row">
                    <div className="trend-top">
                      <span className="trend-label">{entry.label}</span>
                      <span className="trend-value">{formatPesoValue(entry.amount)}</span>
                    </div>
                    <div className="trend-track">
                      <span className="trend-fill" style={{ width: `${entry.width}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
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
                    <button type="button" className="row-btn" onClick={() => handlePrintView(row)}>Print</button>
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
                <button type="button" className="btn apply" onClick={() => handlePrintView()}>Print Report</button>
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
