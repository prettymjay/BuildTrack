import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import './DashBoard.css';
import { formatPesoValue } from '../utils/formatCurrency';
import { authFetch } from '../services/auth';

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');

type Project = {
  id: number;
  title: string;
  progress: number;
  cost: number;
  status: string;
};

type Material = {
  id: number;
  name: string;
  cost: string | null;
};

type Expense = {
  id: number;
  date: string;
  project: string;
  category: string;
  description: string;
  amount: number;
};

function parseCost(value: string | null | undefined) {
  const numeric = Number.parseFloat(String(value ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(numeric) ? numeric : 0;
}

type SnapshotRow = {
  project: string;
  progress: number;
  expenseValue: number;
  expenseRate: number;
};

export default function DashBoard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    try {
      const [projectsRes, materialsRes, expensesRes] = await Promise.all([
        authFetch(`${API_BASE}/api/projects?page=1&perPage=100`),
        authFetch(`${API_BASE}/api/materials?page=1&perPage=100`),
        authFetch(`${API_BASE}/api/expenses?page=1&perPage=100`),
      ]);

      const [projectsJson, materialsJson, expensesJson] = await Promise.all([
        projectsRes.json(),
        materialsRes.json(),
        expensesRes.json(),
      ]);

      setProjects(projectsJson.data || []);
      setMaterials(materialsJson.data || []);
      setExpenses((expensesJson.data || []).map((expense: any) => ({
        ...expense,
        amount: Number(expense.amount || 0) / 100,
      })));
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  }

  const overview = useMemo(() => {
    const totalProjectCost = projects.reduce((sum, project) => sum + (project.cost || 0), 0);
    const materialsPurchased = materials.reduce((sum, material) => sum + parseCost(material.cost), 0);
    const spentToday = expenses
      .filter((expense) => expense.date === new Date().toISOString().slice(0, 10))
      .reduce((sum, expense) => sum + expense.amount, 0);
    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const remainingBudget = totalProjectCost - materialsPurchased - totalExpenses;
    return { spentToday, totalProjectCost, materialsPurchased, totalExpenses, remainingBudget };
  }, [expenses, materials, projects]);

  const quickStatus = useMemo(() => {
    if (projects.length === 0) {
      return 'No projects yet';
    }
    const topProject = [...projects].sort((a, b) => (b.progress || 0) - (a.progress || 0))[0];
    return `${topProject.title} - ${topProject.progress}% complete`;
  }, [projects]);

  const recent = useMemo(() => {
    return [...expenses]
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, 5);
  }, [expenses]);

  const snapshotRows = useMemo<SnapshotRow[]>(() => {
    return projects
      .map((project) => {
        const expenseValue = expenses
          .filter((expense) => expense.project === project.title)
          .reduce((sum, expense) => sum + expense.amount, 0);

        const expenseRate = project.cost > 0
          ? Math.min(100, Math.round((expenseValue / project.cost) * 100))
          : 0;

        return {
          project: project.title,
          progress: Math.max(0, Math.min(100, Math.round(project.progress || 0))),
          expenseValue,
          expenseRate,
        };
      })
      .sort((left, right) => right.expenseValue - left.expenseValue)
      .slice(0, 5);
  }, [expenses, projects]);

  return (
    <div className="dashboard-root">
      <Sidebar />

      <main className="main">
        <header className="topbar">
          <h2>Dashboard</h2>
        </header>

        {loading ? <div className="muted">Loading dashboard...</div> : (
          <>
            <section className="overview">
              <div className="spent-block">
                <div className="spent-big">{formatPesoValue(overview.spentToday)}</div>
                <div className="spent-sub">Spent Today</div>
              </div>

              <div className="cards">
                <div className="card metric-card">
                  <div className="label">Total Project Cost</div>
                  <div className="value money">{formatPesoValue(overview.totalProjectCost)}</div>
                  <div className="progress"><div className="bar" style={{ width: '100%' }} /></div>
                </div>
                <div className="card metric-card">
                  <div className="label">Materials Purchased</div>
                  <div className="value money">{formatPesoValue(overview.materialsPurchased)}</div>
                  <div className="progress"><div className="bar" style={{ width: '100%' }} /></div>
                </div>
                <div className="card metric-card">
                  <div className="label">Total Expenses</div>
                  <div className="value money">{formatPesoValue(overview.totalExpenses)}</div>
                  <div className="progress"><div className="bar" style={{ width: '100%' }} /></div>
                </div>
                <div className="card highlight metric-card">
                  <div className="label">Remaining Budget</div>
                  <div className="value money">{formatPesoValue(overview.remainingBudget)}</div>
                  <div className="muted formula-copy">Project Cost - Materials - Expenses</div>
                  <div className="progress"><div className="bar" style={{ width: '100%' }} /></div>
                </div>
              </div>
            </section>

            <section className="content-grid">
              <div className="chart-card">
                <div className="card-title">Expense Snapshot</div>
                {snapshotRows.length === 0 ? (
                  <div className="chart-placeholder">No expense data yet</div>
                ) : (
                  <div className="snapshot-graph">
                    {snapshotRows.map((row) => (
                      <div key={row.project} className="snapshot-row">
                        <div className="snapshot-top">
                          <div className="snapshot-project">{row.project}</div>
                          <div className="snapshot-amount">{formatPesoValue(row.expenseValue)}</div>
                        </div>
                        <div className="snapshot-bars">
                          <div className="snapshot-track">
                            <span className="snapshot-fill progress-fill" style={{ width: `${row.progress}%` }} />
                          </div>
                          <div className="snapshot-track">
                            <span className="snapshot-fill expense-fill" style={{ width: `${row.expenseRate}%` }} />
                          </div>
                        </div>
                        <div className="snapshot-meta">
                          <span>Progress {row.progress}%</span>
                          <span>Expenses {row.expenseRate}% of project cost</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <aside className="right-widgets">
                <div className="quick-status card">
                  <div className="card-title">Quick Status</div>
                  <div>Leading Project</div>
                  <div className="muted">{quickStatus}</div>
                </div>
              </aside>
            </section>

            <section className="recent-wrap">
              <div className="recent-transactions card fullwidth">
                <div className="card-title">Recent Transactions</div>
                <table>
                  <thead>
                    <tr><th>Date</th><th>Category</th><th>Description</th><th>Project</th><th>Amount</th></tr>
                  </thead>
                  <tbody>
                    {recent.length === 0 ? (
                      <tr><td colSpan={5}>No transactions yet.</td></tr>
                    ) : recent.map((row) => (
                      <tr key={row.id}>
                        <td>{row.date || '-'}</td>
                        <td><span className="tag">{row.category || '-'}</span></td>
                        <td>{row.description || '-'}</td>
                        <td>{row.project || '-'}</td>
                        <td className="neg">-{formatPesoValue(Math.abs(row.amount || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
