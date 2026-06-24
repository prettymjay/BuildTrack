import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import './DashBoard.css';
import { formatPesoValue } from '../utils/formatCurrency';

export default function DashBoard(): JSX.Element {
  const overview = {
    spentToday: 12450.8,
    totalProjectCost: 4200000,
    materialsPurchased: 842000,
    dailyExpenses: 12400,
    remainingBudget: 182000,
  };

  const recent = [
    { date: 'Oct 24, 2023', category: 'Hardware', desc: 'Grade 8 Structural Bolts (500 units)', project: 'Skyline Tower', amount: -1240 },
    { date: 'Oct 24, 2023', category: 'Logistics', desc: 'Freight Delivery Charge - Site A', project: 'Harbor Bridge', amount: -450 },
    { date: 'Oct 23, 2023', category: 'Tools', desc: 'Pneumatic Impact Wrenches (2)', project: 'Metro Station', amount: -895 },
    { date: 'Oct 23, 2023', category: 'Lumber', desc: 'Structural Grade Pine 2x4 (Box)', project: 'Skyline Tower', amount: -2100 },
    { date: 'Oct 22, 2023', category: 'Safety', desc: 'High-Vis Vests and Helmets', project: 'General Inventory', amount: -625 },
  ];

  const navigate = useNavigate();
  const { logout, user } = useAuth();

  function handleAddExpense() {
    navigate('/expenses');
  }

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="dashboard-root">
      <Sidebar />

      <main className="main">
        <header className="topbar">
          <h2>Dashboard</h2>
          <div className="actions">
            <button className="btn add" onClick={handleAddExpense}>+ Add New</button>
          </div>
          <div className="profile">{user?.name ?? 'Alex Rivera'}</div>
        </header>

        <section className="overview">
          <div className="spent-block">
            <div className="spent-big">{formatPesoValue(overview.spentToday)}</div>
            <div className="spent-sub">Spent Today</div>
          </div>

          <div className="cards">
            <div className="card">
              <div className="label">Total Project Cost</div>
              <div className="value">{formatPesoValue(overview.totalProjectCost)}</div>
              <div className="progress"><div className="bar" style={{width:'42%'}}/></div>
            </div>
            <div className="card">
              <div className="label">Materials Purchased</div>
              <div className="value">{formatPesoValue(overview.materialsPurchased)}</div>
              <div className="progress"><div className="bar" style={{width:'60%'}}/></div>
            </div>
            <div className="card">
              <div className="label">Daily Expenses</div>
              <div className="value">{formatPesoValue(overview.dailyExpenses)}</div>
              <div className="progress"><div className="bar" style={{width:'28%'}}/></div>
            </div>
            <div className="card highlight">
              <div className="label">Remaining Budget</div>
              <div className="value">{formatPesoValue(overview.remainingBudget)}</div>
              <div className="progress"><div className="bar" style={{width:'75%'}}/></div>
            </div>
          </div>
        </section>

        <section className="content-grid">
          <div className="chart-card">
            <div className="card-title">Monthly Expense vs Budget</div>
            <div className="chart-placeholder">[ chart ]</div>
          </div>

          <aside className="right-widgets">
            <div className="quick-status card">
              <div className="card-title">Quick Status</div>
              <div>Active Project</div>
              <div className="muted">Skyline Residential Tower — 74% Materials Delivered</div>
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
                {recent.map((r, i) => (
                  <tr key={i}>
                    <td>{r.date}</td>
                    <td><span className="tag">{r.category}</span></td>
                    <td>{r.desc}</td>
                    <td>{r.project}</td>
                    <td className={r.amount < 0 ? 'neg' : 'pos'}>{r.amount < 0 ? `-${formatPesoValue(Math.abs(r.amount))}` : formatPesoValue(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
