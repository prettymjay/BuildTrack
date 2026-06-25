import { useEffect, useMemo, useState } from 'react';
import './Projects.css';
import Sidebar from '../components/Sidebar';
import { formatPesoValue } from '../utils/formatCurrency';
import { authFetch } from '../services/auth';
import { fetchSystemOptions } from '../services/system';

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');

type Project = {
  id: number;
  title: string;
  location: string | null;
  progress: number;
  start_date: string | null;
  target_date: string | null;
  cost: number;
  status: string;
};

const blankProject = {
  title: '',
  location: '',
  cost: 0,
  progress: 0,
  status: 'Planning',
  start_date: '',
  target_date: '',
};

function clampProgress(value: string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(100, Math.max(0, Math.round(numeric)));
}

function formatProjectDate(value: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectStatuses, setProjectStatuses] = useState<string[]>(['Planning', 'Ongoing', 'Completed', 'On Hold', 'Cancelled']);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const perPage = 9;
  const [total, setTotal] = useState(0);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortBy, setSortBy] = useState('recent');
  const [search, setSearch] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [form, setForm] = useState(blankProject);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetchProjects();
  }, [statusFilter, sortBy, page, search]);

  useEffect(() => {
    void loadSystemOptions();
  }, []);

  async function loadSystemOptions() {
    const options = await fetchSystemOptions();
    if (options.project_statuses.length) {
      setProjectStatuses(options.project_statuses);
      setForm((current) => ({ ...current, status: current.status || options.project_statuses[0] || 'Planning' }));
    }
  }

  async function fetchProjects() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('perPage', String(perPage));
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (sortBy) params.set('sort', sortBy);
      const res = await authFetch(`${API_BASE}/api/projects?${params.toString()}`);
      const json = await res.json();
      setProjects(json.data || []);
      setTotal(json.total || 0);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  function getDefaultProjectForm() {
    return {
      ...blankProject,
      status: projectStatuses[0] || blankProject.status,
    };
  }

  function openAddProject() {
    setForm(getDefaultProjectForm());
    setShowAdd(true);
  }

  function closeAddProject() {
    setShowAdd(false);
    setForm(getDefaultProjectForm());
  }

  const projectStats = useMemo(() => {
    const totalCost = projects.reduce((sum, project) => sum + (project.cost || 0), 0);
    const avgProgress = projects.length ? Math.round(projects.reduce((sum, project) => sum + (project.progress || 0), 0) / projects.length) : 0;
    const onHold = projects.filter((project) => project.status === 'On Hold').length;
    const active = projects.filter((project) => project.status !== 'Completed' && project.status !== 'Cancelled').length;
    return { totalCost, avgProgress, onHold, active };
  }, [projects]);

  function getPageList(cur: number, pageCount: number) {
    if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
    const pages: (number | string)[] = [1];
    const left = Math.max(2, cur - 1);
    const right = Math.min(pageCount - 1, cur + 1);
    if (left > 2) pages.push('...');
    for (let p = left; p <= right; p += 1) pages.push(p);
    if (right < pageCount - 1) pages.push('...');
    pages.push(pageCount);
    return pages;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await authFetch(`${API_BASE}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        closeAddProject();
        await fetchProjects();
      }
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  }

  function openEdit(project: Project) {
    setEditProject(project);
    setShowEdit(true);
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editProject) return;
    setSaving(true);
    try {
      const res = await authFetch(`${API_BASE}/api/projects/${editProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editProject),
      });
      if (res.ok) {
        setShowEdit(false);
        setEditProject(null);
        setSelectedProject((current) => (current?.id === editProject.id ? editProject : current));
        await fetchProjects();
      }
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  }

  async function handleDelete(id: number) {
    if (!window.confirm('Delete this project?')) return;
    try {
      const res = await authFetch(`${API_BASE}/api/projects/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (selectedProject?.id === id) {
          setSelectedProject(null);
        }
        await fetchProjects();
      }
    } catch (err) {
      console.error(err);
    }
  }

  function applySearch() {
    setPage(1);
    setSearch(searchDraft.trim());
  }

  return (
    <>
      <Sidebar />
      <main className="main">
        <div className="projects-root">
          <header className="projects-header">
            <div className="header-left">
              <h1 className="page-title">Project Infrastructure</h1>
              <div className="page-sub muted">Managing active construction sites across regions.</div>
            </div>

            <div className="header-center">
              <div className="search-wrap">
                <input
                  className="search input"
                  placeholder="Search projects..."
                  value={searchDraft}
                  onChange={(e) => setSearchDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') applySearch();
                  }}
                />
                <span className="search-icon" aria-hidden="true">Search</span>
              </div>
            </div>

            <div className="header-right">
              <div className="controls">
                <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                  <option>All</option>
                  {projectStatuses.map((status) => <option key={status}>{status}</option>)}
                </select>
                <select value={sortBy} onChange={(e) => { setSortBy(e.target.value); setPage(1); }}>
                  <option value="recent">Recent</option>
                  <option value="cost">Cost</option>
                  <option value="progress">Progress</option>
                </select>
                <div className="view-toggle" role="tablist" aria-label="View toggle">
                  <button className={`icon-btn ${view === 'grid' ? 'active' : ''}`} title="Grid view" onClick={() => setView('grid')}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" /><rect x="13" y="3" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" /><rect x="3" y="13" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" /><rect x="13" y="13" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" /></svg>
                  </button>
                  <button className={`icon-btn ${view === 'list' ? 'active' : ''}`} title="List view" onClick={() => setView('list')}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="5" width="16" height="3" rx="1" stroke="currentColor" strokeWidth="1.5" /><rect x="4" y="10.5" width="16" height="3" rx="1" stroke="currentColor" strokeWidth="1.5" /><rect x="4" y="16" width="16" height="3" rx="1" stroke="currentColor" strokeWidth="1.5" /></svg>
                  </button>
                </div>
                <button className="btn add-btn" onClick={applySearch} type="button">Search</button>
                <button className="btn add-btn" onClick={openAddProject} type="button">Add Project</button>
              </div>
            </div>
          </header>

          <div className="stats-row">
            <div className="stat-panel">
              <div className="label">ACTIVE PROJECTS</div>
              <div className="big">{projectStats.active}</div>
              <div className="muted">Not completed or cancelled</div>
            </div>
            <div className="stat-panel">
              <div className="label">ON HOLD</div>
              <div className="big">{projectStats.onHold}</div>
              <div className="muted">Projects needing follow-up</div>
            </div>
            <div className="stat-panel">
              <div className="label">AVERAGE PROGRESS</div>
              <div className="big">{projectStats.avgProgress}%</div>
              <div className="muted">Across visible projects</div>
            </div>
            <div className="resource-card">
              <div className="label">VISIBLE PROJECT COST</div>
              <div className="big">{formatPesoValue(projectStats.totalCost)}</div>
              <div className="muted">Combined project budget on this page</div>
            </div>
          </div>

          {loading ? <div className="muted">Loading...</div> : projects.length === 0 ? (
            <div className="projects-empty card">
              <div className="projects-empty-kicker">No Projects Yet</div>
              <h3 className="projects-empty-title">Create your first project</h3>
              <p className="projects-empty-copy">
                Add a project name, location, budget, schedule, and status so your team can start tracking progress.
              </p>
              <button className="btn add-btn" type="button" onClick={openAddProject}>Add Project</button>
            </div>
          ) : (
            <section className={view === 'grid' ? 'project-cards' : 'project-list'}>
              {projects.map((project) => (
                <article className={`project-card card ${view}`} key={project.id}>
                  <div className="card-top">
                    <div className="icon-box">Site</div>
                    <div className={`status-tag ${String(project.status).replace(/\s+/g, '-')}`}>{project.status}</div>
                  </div>
                  <h3 className="proj-title">{project.title}</h3>
                  <div className="proj-loc muted">{project.location || 'No location yet'}</div>
                  <div className="progress-row">
                    <div className="progress-label">Construction Progress</div>
                    <div className="progress-pct">{project.progress}%</div>
                  </div>
                  <div className="progress"><div className="bar" style={{ width: `${project.progress}%` }} /></div>
                  <div className="dates muted">START: {formatProjectDate(project.start_date)} <span className="sep">TARGET: {formatProjectDate(project.target_date)}</span></div>
                  <div className="card-bottom">
                    <div className="card-cost-block">
                      <div className="muted small">CURRENT COST</div>
                      <div className="cost text-bold">{formatPesoValue(project.cost || 0)}</div>
                    </div>
                    <div className="card-action-row">
                      <button className="btn btn-secondary" onClick={() => setSelectedProject(project)} type="button">View</button>
                      <button className="btn btn-secondary" onClick={() => openEdit(project)} type="button">Edit</button>
                      <button className="btn btn-danger" onClick={() => handleDelete(project.id)} type="button">Delete</button>
                    </div>
                  </div>
                </article>
              ))}
            </section>
          )}

          <div style={{ paddingTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <div className="pagination">
              <button className="page-arrow" onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="Previous">&lt;</button>
              {getPageList(page, totalPages).map((item, idx) => (typeof item === 'string' ? (
                <span key={idx} className="page-ellipsis">{item}</span>
              ) : (
                <button key={item} className={`page-num ${item === page ? 'active' : ''}`} onClick={() => setPage(item)}>{item}</button>
              )))}
              <button className="page-arrow" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} aria-label="Next">&gt;</button>
            </div>
          </div>

          {showAdd && (
            <div className="modal-overlay">
              <div className="modal card">
                <h3>Add Project</h3>
                <p className="modal-copy">Enter the project details below to add it to your construction dashboard.</p>
                <form onSubmit={handleCreate} className="modal-form">
                  <label>Title
                    <input required placeholder="e.g., Riverside Tower Phase 3" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input" />
                  </label>
                  <label>Location
                    <input placeholder="e.g., Quezon City, Metro Manila" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="input" />
                  </label>
                  <label>Cost (PHP)
                    <div className="field-shell">
                      <span className="field-affix prefix">₱</span>
                      <input type="number" min="0" step="0.01" placeholder="e.g., 2450000" value={form.cost} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} className="input money-input" />
                    </div>
                    <span className="field-note">{formatPesoValue(Number(form.cost) || 0)}</span>
                  </label>
                  <label>Progress
                    <div className="field-shell">
                      <input type="number" min="0" max="100" value={form.progress} onChange={(e) => setForm({ ...form, progress: clampProgress(e.target.value) })} className="input percent-input" />
                      <span className="field-affix suffix">%</span>
                    </div>
                    <span className="field-note">{clampProgress(String(form.progress))}% complete</span>
                  </label>
                  <label>Start date
                    <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="input date-input" />
                  </label>
                  <label>Target date
                    <input type="date" value={form.target_date} onChange={(e) => setForm({ ...form, target_date: e.target.value })} className="input date-input" />
                  </label>
                  <label>Status
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input">
                      {projectStatuses.map((status) => <option key={status}>{status}</option>)}
                    </select>
                  </label>
                  <div className="actions">
                    <button type="button" className="btn btn-secondary" onClick={closeAddProject}>Cancel</button>
                    <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Create'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {showEdit && editProject && (
            <div className="modal-overlay">
              <div className="modal card">
                <h3>Edit Project</h3>
                <form onSubmit={handleEditSubmit} className="modal-form">
                  <label>Title
                    <input required value={editProject.title || ''} onChange={(e) => setEditProject({ ...editProject, title: e.target.value })} className="input" />
                  </label>
                  <label>Location
                    <input value={editProject.location || ''} onChange={(e) => setEditProject({ ...editProject, location: e.target.value })} className="input" />
                  </label>
                  <label>Cost (PHP)
                    <div className="field-shell">
                      <span className="field-affix prefix">₱</span>
                      <input type="number" min="0" step="0.01" value={editProject.cost || 0} onChange={(e) => setEditProject({ ...editProject, cost: Number(e.target.value) })} className="input money-input" />
                    </div>
                    <span className="field-note">{formatPesoValue(Number(editProject.cost) || 0)}</span>
                  </label>
                  <label>Progress
                    <div className="field-shell">
                      <input type="number" min="0" max="100" value={editProject.progress || 0} onChange={(e) => setEditProject({ ...editProject, progress: clampProgress(e.target.value) })} className="input percent-input" />
                      <span className="field-affix suffix">%</span>
                    </div>
                    <span className="field-note">{clampProgress(String(editProject.progress || 0))}% complete</span>
                  </label>
                  <label>Start date
                    <input type="date" value={editProject.start_date || ''} onChange={(e) => setEditProject({ ...editProject, start_date: e.target.value })} className="input date-input" />
                  </label>
                  <label>Target date
                    <input type="date" value={editProject.target_date || ''} onChange={(e) => setEditProject({ ...editProject, target_date: e.target.value })} className="input date-input" />
                  </label>
                  <label>Status
                    <select value={editProject.status || 'Planning'} onChange={(e) => setEditProject({ ...editProject, status: e.target.value })} className="input">
                      {projectStatuses.map((status) => <option key={status}>{status}</option>)}
                    </select>
                  </label>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => { setShowEdit(false); setEditProject(null); }}>Cancel</button>
                    <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {selectedProject && (
            <div className="modal-overlay">
              <div className="modal card">
                <h3>{selectedProject.title}</h3>
                <div className="modal-form">
                  <label>Location
                    <input value={selectedProject.location || ''} readOnly className="input" />
                  </label>
                  <label>Status
                    <input value={selectedProject.status} readOnly className="input" />
                  </label>
                  <label>Progress
                    <input value={`${selectedProject.progress}%`} readOnly className="input" />
                  </label>
                  <label>Current Cost
                    <input value={formatPesoValue(selectedProject.cost || 0)} readOnly className="input" />
                  </label>
                  <label>Start date
                    <input value={formatProjectDate(selectedProject.start_date)} readOnly className="input" />
                  </label>
                  <label>Target date
                    <input value={formatProjectDate(selectedProject.target_date)} readOnly className="input" />
                  </label>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setSelectedProject(null)}>Close</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
