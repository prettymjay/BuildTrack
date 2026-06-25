import { useEffect, useMemo, useState } from 'react';
import './Expenses.css';
import Sidebar from '../components/Sidebar';
import { formatPesoValue } from '../utils/formatCurrency';
import { authFetch } from '../services/auth';
import { fetchSystemOptions } from '../services/system';

type Expense = {
  id: number;
  date: string;
  project: string;
  category: string;
  description: string;
  amount: number;
  status: 'Paid' | 'Unpaid' | 'Partially Paid' | 'Cancelled';
};

type ExpenseForm = Omit<Expense, 'id'>;

type ProjectOption = {
  id: number;
  title: string;
};

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');

const blankExpense: ExpenseForm = {
  date: '',
  project: '',
  category: '',
  description: '',
  amount: 0,
  status: 'Unpaid',
};

export default function Expenses() {
  const [items, setItems] = useState<Expense[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [date, setDate] = useState('');
  const [project, setProject] = useState('All Projects');
  const [category, setCategory] = useState('All Categories');
  const [expenseCategoryOptions, setExpenseCategoryOptions] = useState<string[]>([]);
  const [paymentStatusOptions, setPaymentStatusOptions] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [perPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [form, setForm] = useState<ExpenseForm>(blankExpense);
  const [editItem, setEditItem] = useState<Expense | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetchExpenses();
  }, [page, perPage, date, project, category]);

  useEffect(() => {
    void loadSystemOptions();
    void loadProjects();
  }, []);

  async function loadSystemOptions() {
    const options = await fetchSystemOptions();
    setExpenseCategoryOptions(options.daily_expense_categories);
    setPaymentStatusOptions(options.payment_statuses);
    setForm((current) => ({
      ...current,
      category: current.category || options.daily_expense_categories[0] || '',
      status: (current.status || options.payment_statuses[0] || 'Unpaid') as Expense['status'],
    }));
  }

  async function loadProjects() {
    try {
      const response = await authFetch(`${API_BASE}/api/projects?page=1&perPage=500`);
      if (!response.ok) {
        return;
      }

      const json = await response.json();
      setProjects(json.data || []);
    } catch (err) {
      console.error('fetch projects', err);
    }
  }

  async function fetchExpenses() {
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('perPage', String(perPage));
      if (project && project !== 'All Projects' && project !== 'All') params.set('project', project);
      if (category && category !== 'All Categories' && category !== 'All') params.set('category', category);
      if (date) params.set('date', date);
      const res = await authFetch(`${API_BASE}/api/expenses?${params.toString()}`);
      const json = await res.json();
      const rows = (json.data || []).map((row: any) => ({
        ...row,
        amount: Number(row.amount || 0) / 100,
      }));
      setItems(rows);
      setTotal(json.total || 0);
    } catch (err) {
      console.error('fetch expenses', err);
    }
  }

  const stats = useMemo(() => {
    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
    const labor = items.filter((item) => item.category === 'Labor').reduce((sum, item) => sum + item.amount, 0);
    const logistics = items
      .filter((item) => item.category === 'Transportation' || item.category === 'Fuel')
      .reduce((sum, item) => sum + item.amount, 0);
    const unpaid = items.filter((item) => item.status === 'Unpaid').reduce((sum, item) => sum + item.amount, 0);
    return { totalAmount, labor, logistics, unpaid };
  }, [items]);

  const projectOptions = useMemo(() => {
    const values = new Set<string>(projects.map((item) => item.title).filter(Boolean));
    items.forEach((item) => {
      if (item.project) values.add(item.project);
    });
    return ['All Projects', ...Array.from(values).sort()];
  }, [items, projects]);

  const expenseProjectOptions = useMemo(
    () => Array.from(new Set(projects.map((item) => item.title).filter(Boolean))).sort(),
    [projects],
  );

  function getDefaultExpenseForm() {
    return {
      ...blankExpense,
      date: new Date().toISOString().slice(0, 10),
      category: expenseCategoryOptions[0] || '',
      status: (paymentStatusOptions[0] as Expense['status']) || 'Unpaid',
    };
  }

  const categoryOptions = useMemo(() => {
    if (expenseCategoryOptions.length) {
      return ['All Categories', ...expenseCategoryOptions];
    }
    const values = new Set<string>();
    items.forEach((item) => {
      if (item.category) values.add(item.category);
    });
    return ['All Categories', ...Array.from(values).sort()];
  }, [expenseCategoryOptions, items]);

  function openEditExpense(item: Expense) {
    setEditItem(item);
    setShowEdit(true);
  }

  async function handleCreateExpense(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await authFetch(`${API_BASE}/api/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setPage(1);
        setDate('');
        setProject('All Projects');
        setCategory('All Categories');
        setShowAdd(false);
        setForm(getDefaultExpenseForm());
        await fetchExpenses();
      }
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  }

  async function handleEditExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!editItem) return;
    setSaving(true);
    try {
      const res = await authFetch(`${API_BASE}/api/expenses/${editItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editItem),
      });
      if (res.ok) {
        await fetchExpenses();
        setShowEdit(false);
        setEditItem(null);
      }
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  }

  async function handleDeleteExpense(id: number) {
    if (!window.confirm('Delete this expense?')) return;
    try {
      const res = await authFetch(`${API_BASE}/api/expenses/${id}`, { method: 'DELETE' });
      if (res.ok) await fetchExpenses();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <>
      <Sidebar />
      <main className="main">
        <div className="expenses-root">
          <div className="expenses-header">
            <div>
              <h1 className="expenses-title">Project Expenses</h1>
              <div className="expenses-sub">Track daily construction costs using standardized expense and payment categories.</div>
            </div>
            <div className="expenses-controls">
              <input type="date" className="date-filter" value={date} onChange={(e) => { setDate(e.target.value); setPage(1); }} />
              <select className="proj-filter" value={project} onChange={(e) => { setProject(e.target.value); setPage(1); }}>
                {projectOptions.map((option) => <option key={option}>{option}</option>)}
              </select>
              <select className="proj-filter" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
                {categoryOptions.map((option) => <option key={option}>{option}</option>)}
              </select>
              <button className="btn add-exp" onClick={() => { setForm(getDefaultExpenseForm()); setShowAdd(true); }} type="button">Add Expense</button>
            </div>
          </div>

          <div className="summary-cards">
            <div className="card small">
              <div className="label">VISIBLE EXPENSES</div>
              <div className="value">{formatPesoValue(stats.totalAmount)}</div>
              <div className="delta">Current page total</div>
            </div>
            <div className="card small">
              <div className="label">LABOR COSTS</div>
              <div className="value small-val">{formatPesoValue(stats.labor)}</div>
            </div>
            <div className="card small">
              <div className="label">TRANSPORT + FUEL</div>
              <div className="value small-val">{formatPesoValue(stats.logistics)}</div>
            </div>
            <div className="card small">
              <div className="label">UNPAID TOTAL</div>
              <div className="value small-val">{formatPesoValue(stats.unpaid)}</div>
            </div>
          </div>

          <div className="expenses-table-wrap">
            <div className="table-header">
              <h3>Recorded Expenses</h3>
              <div className="table-controls">
                <input type="date" className="inline-date" value={date} onChange={(e) => { setDate(e.target.value); setPage(1); }} />
                <select className="proj-filter-small" value={project} onChange={(e) => { setProject(e.target.value); setPage(1); }}>
                  {projectOptions.map((option) => <option key={option}>{option}</option>)}
                </select>
              </div>
            </div>

            <table className="expenses-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Project Name</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Payment Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="muted">No expenses recorded yet.</td>
                  </tr>
                ) : items.map((item) => (
                  <tr key={item.id}>
                    <td className="mono">{item.date || '-'}</td>
                    <td className="strong">{item.project || '-'}</td>
                    <td><span className="tag small">{item.category || '-'}</span></td>
                    <td className="muted">{item.description || '-'}</td>
                    <td className="amount">{formatPesoValue(item.amount)}</td>
                    <td><span className={`status ${item.status.replace(/\s+/g, '-')}`}>{item.status}</span></td>
                    <td className="actions">
                      <button className="icon" title="Edit" onClick={() => openEditExpense(item)} type="button">Edit</button>
                      <button className="icon" title="Delete" onClick={() => handleDeleteExpense(item.id)} type="button">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="table-footer">
              <div>Showing {total === 0 ? 0 : (page - 1) * perPage + 1} - {Math.min(page * perPage, total)} of {total} recorded expenses</div>
              <div className="pagination small">
                <button className="page-arrow" onClick={() => setPage((p) => Math.max(1, p - 1))} type="button">Previous</button>
                <button className="page-arrow" onClick={() => setPage((p) => (page * perPage >= total ? p : p + 1))} type="button">Next</button>
              </div>
            </div>
          </div>

          {showAdd && (
            <div className="modal-overlay">
              <div className="modal card">
                <h3>Add Expense</h3>
                <form onSubmit={handleCreateExpense} className="modal-form">
                  <label>Date
                    <input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input" />
                  </label>
                  <label>Project
                    <select required value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} className="input">
                      <option value="">Select project</option>
                      {expenseProjectOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  <label>Category
                    <select required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input">
                      <option value="">Select category</option>
                      {expenseCategoryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  <label>Description
                    <input placeholder="e.g., Rebar delivery for Tower B" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input" />
                  </label>
                  <label>Amount (PHP)
                    <div className="expense-input-shell">
                      <span className="expense-affix">₱</span>
                      <input type="number" min="0" step="0.01" placeholder="e.g., 4280.50" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} className="input amount-input" />
                    </div>
                    <span className="field-note">{formatPesoValue(Number(form.amount) || 0)}</span>
                  </label>
                  <label>Payment Status
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Expense['status'] })} className="input">
                      {paymentStatusOptions.map((option) => <option key={option}>{option}</option>)}
                    </select>
                  </label>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => { setShowAdd(false); setForm(getDefaultExpenseForm()); }}>Cancel</button>
                    <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Create'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {showEdit && editItem && (
            <div className="modal-overlay">
              <div className="modal card">
                <h3>Edit Expense</h3>
                <form onSubmit={handleEditExpense} className="modal-form">
                  <label>Date
                    <input required type="date" value={editItem.date || ''} onChange={(e) => setEditItem({ ...editItem, date: e.target.value })} className="input" />
                  </label>
                  <label>Project
                    <select required value={editItem.project || ''} onChange={(e) => setEditItem({ ...editItem, project: e.target.value })} className="input">
                      <option value="">Select project</option>
                      {expenseProjectOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  <label>Category
                    <select value={editItem.category || ''} onChange={(e) => setEditItem({ ...editItem, category: e.target.value })} className="input">
                      <option value="">Select category</option>
                      {expenseCategoryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  <label>Description
                    <input value={editItem.description || ''} onChange={(e) => setEditItem({ ...editItem, description: e.target.value })} className="input" />
                  </label>
                  <label>Amount (PHP)
                    <div className="expense-input-shell">
                      <span className="expense-affix">₱</span>
                      <input type="number" min="0" step="0.01" value={editItem.amount || 0} onChange={(e) => setEditItem({ ...editItem, amount: Number(e.target.value) })} className="input amount-input" />
                    </div>
                    <span className="field-note">{formatPesoValue(Number(editItem.amount) || 0)}</span>
                  </label>
                  <label>Payment Status
                    <select value={editItem.status} onChange={(e) => setEditItem({ ...editItem, status: e.target.value as Expense['status'] })} className="input">
                      {paymentStatusOptions.map((option) => <option key={option}>{option}</option>)}
                    </select>
                  </label>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => { setShowEdit(false); setEditItem(null); }}>Cancel</button>
                    <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
