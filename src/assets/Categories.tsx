import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import './Categories.css';
import { authFetch } from '../services/auth';
import { fetchSystemOptions } from '../services/system';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';
const PAGE_SIZE = 4;

type Category = {
  id: number;
  name: string;
  description?: string | null;
};

type MaterialRecord = {
  id: number;
  category: string | null;
  unit: string | null;
};

type ExpenseRecord = {
  id: number;
  category: string | null;
};

type ProjectRecord = {
  id: number;
  status: string | null;
};

type TabKey = 'materials' | 'expenses' | 'projects' | 'units';

type DashboardRow = {
  key: string;
  name: string;
  type: string;
  usageCount: number;
  status: 'Active' | 'Inactive';
  description: string;
  editable: boolean;
  category?: Category;
  group?: 'daily_expense_categories' | 'project_statuses' | 'unit_categories';
};

const blankCategory = {
  name: '',
  description: '',
};

function CategoryIcon({ tab }: { tab: TabKey }) {
  if (tab === 'expenses') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 4h10l2 3v12H5V7l2-3Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M9 10h6M9 14h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  if (tab === 'projects') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 19h16M6 19V9l6-4 6 4v10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 19v-4h4v4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (tab === 'units') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 4h12v16H6z" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M9 8h6M9 12h6M9 16h3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 7h14v10H5z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 7V5h8v2M9 11h6M9 15h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function Categories() {
  const [materialCategories, setMaterialCategories] = useState<Category[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<string[]>([]);
  const [projectStatuses, setProjectStatuses] = useState<string[]>([]);
  const [unitCategories, setUnitCategories] = useState<string[]>([]);
  const [materials, setMaterials] = useState<MaterialRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('expenses');
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [editingSystemItem, setEditingSystemItem] = useState<string | null>(null);
  const [form, setForm] = useState(blankCategory);

  useEffect(() => {
    void Promise.all([
      loadSystemOptions(),
      loadCategories(),
      loadMaterials(),
      loadExpenses(),
      loadProjects(),
    ]);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [activeTab, query]);

  async function readErrorMessage(response: Response) {
    try {
      const json = await response.json();
      return json?.error || 'Request failed';
    } catch {
      return 'Request failed';
    }
  }

  async function loadSystemOptions() {
    const options = await fetchSystemOptions();
    setExpenseCategories(options.daily_expense_categories || []);
    setProjectStatuses(options.project_statuses || []);
    setUnitCategories(options.unit_categories || []);
  }

  async function loadCategories() {
    try {
      const response = await authFetch(`${API_BASE}/api/categories`);
      if (!response.ok) {
        setMessage(await readErrorMessage(response));
        return;
      }
      const data = await response.json();
      setMaterialCategories(data.data || []);
    } catch {
      setMessage('Unable to load material categories');
    }
  }

  async function loadMaterials() {
    try {
      const response = await authFetch(`${API_BASE}/api/materials?page=1&perPage=500`);
      if (!response.ok) return;
      const data = await response.json();
      setMaterials(data.data || []);
    } catch {
      // Keep the dashboard usable even if stats fail to load.
    }
  }

  async function loadExpenses() {
    try {
      const response = await authFetch(`${API_BASE}/api/expenses?page=1&perPage=500`);
      if (!response.ok) return;
      const data = await response.json();
      setExpenses(data.data || []);
    } catch {
      // Keep the dashboard usable even if stats fail to load.
    }
  }

  async function loadProjects() {
    try {
      const response = await authFetch(`${API_BASE}/api/projects?page=1&perPage=500`);
      if (!response.ok) return;
      const data = await response.json();
      setProjects(data.data || []);
    } catch {
      // Keep the dashboard usable even if stats fail to load.
    }
  }

  function openCreate() {
    setEditing(null);
    setEditingSystemItem(null);
    setForm(blankCategory);
    setEditorOpen(true);
    setMessage(null);
  }

  function openEdit(category: Category) {
    setEditing(category);
    setEditingSystemItem(null);
    setEditorOpen(true);
    setMessage(null);
    setActiveTab('materials');
  }

  function openEditSystemItem(name: string, tab: TabKey) {
    setEditing(null);
    setEditingSystemItem(name);
    setForm({ name, description: '' });
    setEditorOpen(true);
    setMessage(null);
    setActiveTab(tab);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditing(null);
    setEditingSystemItem(null);
    setForm(blankCategory);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const response = activeTab === 'materials'
        ? await authFetch(`${API_BASE}/api/categories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
          })
        : await authFetch(`${API_BASE}/api/system/options/${systemGroupForTab(activeTab)}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: form.name }),
          });

      if (!response.ok) {
        setMessage(await readErrorMessage(response));
        return;
      }

      setMessage(`${tabLabels[activeTab]} item created`);
      setForm(blankCategory);
      await reloadForTab(activeTab);
      closeEditor();
    } catch {
      setMessage('Network error');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (activeTab === 'materials' && !editing) return;
    if (activeTab !== 'materials' && !editingSystemItem) return;
    setSaving(true);
    setMessage(null);
    try {
      const response = activeTab === 'materials'
        ? await authFetch(`${API_BASE}/api/categories/${editing!.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editing),
          })
        : await authFetch(`${API_BASE}/api/system/options/${systemGroupForTab(activeTab)}/items/${encodeURIComponent(editingSystemItem!)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: form.name }),
          });

      if (!response.ok) {
        setMessage(await readErrorMessage(response));
        return;
      }

      setMessage(`${tabLabels[activeTab]} item updated`);
      await reloadForTab(activeTab);
      closeEditor();
    } catch {
      setMessage('Network error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(category: Category) {
    if (!window.confirm(`Delete category "${category.name}"?`)) return;
    setMessage(null);
    try {
      const response = await authFetch(`${API_BASE}/api/categories/${category.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        setMessage(await readErrorMessage(response));
        return;
      }

      if (editing?.id === category.id) {
        closeEditor();
      }
      setMessage('Material category deleted');
      await Promise.all([loadCategories(), loadMaterials()]);
    } catch {
      setMessage('Network error');
    }
  }

  async function handleDeleteSystemItem(name: string, tab: TabKey) {
    if (!window.confirm(`Delete "${name}" from ${tabLabels[tab]}?`)) return;
    setMessage(null);
    try {
      const response = await authFetch(`${API_BASE}/api/system/options/${systemGroupForTab(tab)}/items/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        setMessage(await readErrorMessage(response));
        return;
      }

      if (editingSystemItem === name) {
        closeEditor();
      }
      setMessage(`${tabLabels[tab]} item deleted`);
      await reloadForTab(tab);
    } catch {
      setMessage('Network error');
    }
  }

  function systemGroupForTab(tab: TabKey) {
    if (tab === 'expenses') return 'daily_expense_categories';
    if (tab === 'projects') return 'project_statuses';
    return 'unit_categories';
  }

  async function reloadForTab(tab: TabKey) {
    if (tab === 'materials') {
      await Promise.all([loadCategories(), loadMaterials()]);
      return;
    }

    if (tab === 'expenses') {
      await Promise.all([loadSystemOptions(), loadExpenses()]);
      return;
    }

    if (tab === 'projects') {
      await Promise.all([loadSystemOptions(), loadProjects()]);
      return;
    }

    await Promise.all([loadSystemOptions(), loadMaterials()]);
  }

  const allRows = useMemo<Record<TabKey, DashboardRow[]>>(() => {
    const materialUsage = materials.reduce<Record<string, number>>((acc, item) => {
      const key = item.category?.trim();
      if (key) acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const expenseUsage = expenses.reduce<Record<string, number>>((acc, item) => {
      const key = item.category?.trim();
      if (key) acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const projectUsage = projects.reduce<Record<string, number>>((acc, item) => {
      const key = item.status?.trim();
      if (key) acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const unitUsage = materials.reduce<Record<string, number>>((acc, item) => {
      const key = item.unit?.trim();
      if (key) acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return {
      materials: materialCategories.map((category) => ({
        key: `material-${category.id}`,
        name: category.name,
        type: 'Material',
        usageCount: materialUsage[category.name] || 0,
        status: (materialUsage[category.name] || 0) > 0 ? 'Active' : 'Inactive',
        description: category.description || 'Used in inventory material selection.',
        editable: true,
        category,
      })),
      expenses: expenseCategories.map((name) => ({
        key: `expense-${name}`,
        name,
        type: 'Expense',
        usageCount: expenseUsage[name] || 0,
        status: (expenseUsage[name] || 0) > 0 ? 'Active' : 'Inactive',
        description: 'System expense category used in expense forms.',
        editable: true,
        group: 'daily_expense_categories',
      })),
      projects: projectStatuses.map((name) => ({
        key: `project-${name}`,
        name,
        type: 'Project Status',
        usageCount: projectUsage[name] || 0,
        status: (projectUsage[name] || 0) > 0 ? 'Active' : 'Inactive',
        description: 'System project status used in project tracking.',
        editable: true,
        group: 'project_statuses',
      })),
      units: unitCategories.map((name) => ({
        key: `unit-${name}`,
        name,
        type: 'Unit',
        usageCount: unitUsage[name] || 0,
        status: (unitUsage[name] || 0) > 0 ? 'Active' : 'Inactive',
        description: 'System unit available in material quantity setup.',
        editable: true,
        group: 'unit_categories',
      })),
    };
  }, [expenseCategories, expenses, materialCategories, materials, projectStatuses, projects, unitCategories]);

  const filteredRows = useMemo(() => {
    const rows = allRows[activeTab];
    const normalized = query.trim().toLowerCase();
    if (!normalized) return rows;
    return rows.filter((row) =>
      [row.name, row.type, row.description].join(' ').toLowerCase().includes(normalized),
    );
  }, [activeTab, allRows, query]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const activeCount = filteredRows.filter((row) => row.status === 'Active').length;
  const topRows = [...filteredRows].sort((a, b) => b.usageCount - a.usageCount).slice(0, 3);
  const maxUsage = Math.max(1, ...topRows.map((row) => row.usageCount));
  const linkedRecords = materials.length + expenses.length + projects.length;

  const tabLabels: Record<TabKey, string> = {
    expenses: 'Expense Categories',
    materials: 'Material Categories',
    projects: 'Project Status',
    units: 'Unit Categories',
  };

  return (
    <>
      <Sidebar />
      <main className="main">
        <div className="categories-root">
          <header className="category-hero">
            <div className="category-hero-copy">
              <h1 className="category-hero-title">Category Management</h1>
              <p className="category-hero-sub">
                Configure and organize the foundational labels for tracking hardware procurement, material logistics, and operational expenditures.
              </p>
            </div>

            <div className="category-summary-card">
              <div className="category-summary-label">Total Active</div>
              <div className="category-summary-value">{activeCount} Categories</div>
              <div className="category-summary-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M12 3v6m0 0 3-3m-3 3L9 6M6 21l2.5-7h7L18 21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </header>

          <section className="category-board">
            <div className="category-board-toolbar">
              <div className="category-tabs" role="tablist" aria-label="Category groups">
                {(['expenses', 'materials', 'projects', 'units'] as TabKey[]).map((tab) => (
                  <button
                    key={tab}
                    className={`category-tab ${activeTab === tab ? 'active' : ''}`}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                  >
                    <span className="tab-icon"><CategoryIcon tab={tab} /></span>
                    <span>{tabLabels[tab]}</span>
                  </button>
                ))}
              </div>

              <div className="category-toolbar-actions">
                <input
                  className="category-search-input"
                  placeholder={`Search ${tabLabels[activeTab].toLowerCase()}...`}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <button className="toolbar-icon-btn" type="button" onClick={() => setQuery('')} aria-label="Clear search">
                  <svg viewBox="0 0 24 24">
                    <path d="M4 7h16M7 12h10M10 17h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
                <button className="toolbar-icon-btn" type="button" onClick={() => void Promise.all([loadCategories(), loadMaterials(), loadExpenses(), loadProjects()])} aria-label="Refresh data">
                  <svg viewBox="0 0 24 24">
                    <path d="M19 7v5h-5M5 17v-5h5M7.5 9A7 7 0 0 1 19 12M16.5 15A7 7 0 0 1 5 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button className="add-category-btn" type="button" onClick={openCreate}>Add Category</button>
              </div>
            </div>

            <div className="category-table-wrap">
              <table className="category-table">
                <thead>
                  <tr>
                    <th>Category Name</th>
                    <th>Type</th>
                    <th>Usage Count</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentRows.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <div className="category-empty-state">
                          No items found for this view.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    currentRows.map((row) => (
                      <tr key={row.key}>
                        <td>
                          <div className="category-name-cell">
                            <span className="category-cell-icon"><CategoryIcon tab={activeTab} /></span>
                            <div>
                              <div className="category-table-name">{row.name}</div>
                              <div className="category-table-desc">{row.description}</div>
                            </div>
                          </div>
                        </td>
                        <td><span className="category-type-pill">{row.type}</span></td>
                        <td>{row.usageCount} records</td>
                        <td>
                          <span className={`category-status-pill ${row.status.toLowerCase()}`}>
                            <span className="status-dot" />
                            {row.status}
                          </span>
                        </td>
                        <td>
                          <div className="category-row-actions">
                            {row.editable && row.category ? (
                              <>
                                <button className="row-action-btn" type="button" onClick={() => openEdit(row.category!)} aria-label={`Edit ${row.name}`}>
                                  <svg viewBox="0 0 24 24">
                                    <path d="M4 20h4l10-10-4-4L4 16v4ZM14 6l4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </button>
                                <button className="row-action-btn" type="button" onClick={() => handleDelete(row.category!)} aria-label={`Delete ${row.name}`}>
                                  <svg viewBox="0 0 24 24">
                                    <path d="M5 7h14M9 7V5h6v2M8 7v12m8-12v12M6 7l1 13h10l1-13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </button>
                              </>
                            ) : row.editable ? (
                              <>
                                <button className="row-action-btn" type="button" onClick={() => openEditSystemItem(row.name, activeTab)} aria-label={`Edit ${row.name}`}>
                                  <svg viewBox="0 0 24 24">
                                    <path d="M4 20h4l10-10-4-4L4 16v4ZM14 6l4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </button>
                                <button className="row-action-btn" type="button" onClick={() => handleDeleteSystemItem(row.name, activeTab)} aria-label={`Delete ${row.name}`}>
                                  <svg viewBox="0 0 24 24">
                                    <path d="M5 7h14M9 7V5h6v2M8 7v12m8-12v12M6 7l1 13h10l1-13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </button>
                              </>
                            ) : <span className="system-lock-pill">System</span>}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="category-table-footer">
              <div>
                Showing {currentRows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, filteredRows.length)} of {filteredRows.length} {tabLabels[activeTab]}
              </div>
              <div className="table-pagination">
                <button className="pagination-btn" type="button" onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
                <button className="pagination-btn" type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</button>
              </div>
            </div>
          </section>

          <section className="category-insights-grid">
            <article className="insight-card">
              <div className="insight-header">
                <div>
                  <h2>Category Allocation</h2>
                  <p>Highest usage items for the current category view.</p>
                </div>
                <button className="insight-link-btn" type="button" onClick={() => setActiveTab('materials')}>View Materials</button>
              </div>

              <div className="allocation-list">
                {topRows.length === 0 ? (
                  <div className="categories-empty compact">
                    <div className="empty-title">No category activity yet</div>
                    <div className="empty-sub">Once records are added, the busiest categories will appear here.</div>
                  </div>
                ) : (
                  topRows.map((row) => (
                    <div key={row.key} className="allocation-item">
                      <div className="allocation-top">
                        <div>
                          <div className="allocation-name">{row.name}</div>
                          <div className="allocation-meta">{row.description}</div>
                        </div>
                        <div className="allocation-count">{row.usageCount} items</div>
                      </div>
                      <div className="allocation-bar">
                        <span style={{ width: `${Math.max(12, (row.usageCount / maxUsage) * 100)}%` }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>

            <article className="sync-card">
              <div className="sync-overlay" />
              <div className="sync-content">
                <div className="sync-kicker">Inventory System Sync</div>
                <h2>Live category tracking across your connected app data</h2>
                <p>
                  Real-time category tracking across {linkedRecords} linked records. Materials, expenses, project stages, and units stay aligned with the same operational labels.
                </p>
                <div className="sync-metrics">
                  <div>
                    <span>Accuracy</span>
                    <strong>99.8%</strong>
                  </div>
                  <div>
                    <span>Coverage</span>
                    <strong>{materialCategories.length + expenseCategories.length + projectStatuses.length + unitCategories.length}</strong>
                  </div>
                </div>
              </div>
            </article>
          </section>

          {editorOpen ? (
            <div className="category-modal-backdrop" onClick={closeEditor}>
              <div className="category-modal" onClick={(event) => event.stopPropagation()}>
                <div className="modal-kicker">{editing || editingSystemItem ? `Edit ${tabLabels[activeTab]}` : `Create ${tabLabels[activeTab]}`}</div>
                <h2>{editing ? editing.name : editingSystemItem || `Add a new ${tabLabels[activeTab].toLowerCase()} item`}</h2>
                <form className="category-form" onSubmit={editing || editingSystemItem ? handleUpdate : handleCreate}>
                  <label>
                    <span>Category Name</span>
                    <input
                      value={editing ? editing.name : form.name}
                      onChange={(e) => {
                        if (editing) {
                          setEditing({ ...editing, name: e.target.value });
                          return;
                        }
                        setForm({ ...form, name: e.target.value });
                      }}
                      placeholder={activeTab === 'materials' ? 'e.g., Cement' : `Enter ${tabLabels[activeTab].toLowerCase()} name`}
                      required
                    />
                  </label>
                  {activeTab === 'materials' ? (
                    <label>
                      <span>Description / Examples</span>
                      <textarea
                        value={editing ? editing.description || '' : form.description}
                        onChange={(e) => {
                          if (editing) {
                            setEditing({ ...editing, description: e.target.value });
                            return;
                          }
                          setForm({ ...form, description: e.target.value });
                        }}
                        placeholder="e.g., Portland Cement, Masonry Cement"
                      />
                    </label>
                  ) : null}
                  {message ? <div className="category-message inline">{message}</div> : null}
                  <div className="category-form-actions split">
                    <button className="category-secondary-btn" type="button" onClick={closeEditor}>Cancel</button>
                    <button className="category-primary-btn" type="submit" disabled={saving}>
                      {saving ? 'Saving...' : editing || editingSystemItem ? 'Save Changes' : 'Add Category'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </>
  );
}
