import React, { useEffect, useState } from 'react';
import './Projects.css';
import Sidebar from '../components/Sidebar';
import { formatPesoValue } from '../utils/formatCurrency';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../services/auth';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

function fmtUSD(v: number) {
  return formatPesoValue(v);
}

export default function Projects(): JSX.Element {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const perPage = 9;
  const [total, setTotal] = useState(0);
  const [view, setView] = useState<'grid'|'list'>('grid');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortBy, setSortBy] = useState('recent');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({title:'', location:'', cost:0, progress:0, status:'Initializing', start_date:'', target_date:''});
  const [showEdit, setShowEdit] = useState(false);
  const [editProject, setEditProject] = useState<any | null>(null);

  useEffect(()=>{ fetchProjects(); }, [statusFilter, sortBy, page]);

  async function fetchProjects(){
    setLoading(true);
    try{
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('perPage', String(perPage));
      if(statusFilter) params.set('status', statusFilter);
      if(sortBy) params.set('sort', sortBy);
      const res = await authFetch(`${API_BASE}/api/projects?${params.toString()}`);
      const json = await res.json();
      setProjects(json.data || []);
      setTotal(json.total || 0);
    }catch(e){ console.error(e); }
    setLoading(false);
  }

  function getPageList(cur: number, totalPages: number){
    if(totalPages <= 7) return Array.from({length: totalPages}, (_,i)=>i+1);
    const pages: (number|string)[] = [];
    pages.push(1);
    let left = Math.max(2, cur-1);
    let right = Math.min(totalPages-1, cur+1);
    if(left > 2) pages.push('...');
    for(let p = left; p <= right; p++) pages.push(p);
    if(right < totalPages-1) pages.push('...');
    pages.push(totalPages);
    return pages;
  }

  async function handleCreate(e:any){
    e.preventDefault();
    try{
      const res = await authFetch(`${API_BASE}/api/projects`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});
      if(res.ok){
        const p = await res.json();
        setProjects(prev=>[p,...prev]);
        setShowAdd(false);
        setForm({title:'', location:'', cost:0, progress:0, status:'Initializing', start_date:'', target_date:''});
      }else{
        console.error('create failed');
      }
    }catch(err){console.error(err)}
  }

  function openEdit(p:any){
    setEditProject(p);
    setShowEdit(true);
  }

  async function handleEditSubmit(e:any){
    e.preventDefault();
    if(!editProject) return;
    try{
      const res = await authFetch(`${API_BASE}/api/projects/${editProject.id}`, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(editProject)});
      if(res.ok){
        const updated = await res.json();
        setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
        setShowEdit(false);
        setEditProject(null);
      } else console.error('update failed');
    }catch(err){console.error(err)}
  }

  async function handleDelete(id:any){
    if(!window.confirm('Delete this project?')) return;
    try{
      const res = await authFetch(`${API_BASE}/api/projects/${id}`, { method: 'DELETE' });
      if(res.ok){
        setProjects(prev => prev.filter(p => p.id !== id));
      } else console.error('delete failed');
    }catch(err){console.error(err)}
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
            <input className="search input" placeholder="Search projects..." onChange={e=>{/* optional search */}} />
            <button className="icon-btn search-btn" aria-label="Search">🔍</button>
          </div>
        </div>

        <div className="header-right">
          <div className="controls">
            <select value={statusFilter} onChange={e=>{ setStatusFilter(e.target.value); setPage(1); }}>
              <option>All</option>
              <option>On Schedule</option>
              <option>At Risk</option>
              <option>Initializing</option>
            </select>
            <select value={sortBy} onChange={e=>{ setSortBy(e.target.value); setPage(1); }}>
              <option value="recent">Recent</option>
              <option value="cost">Cost</option>
              <option value="progress">Progress</option>
            </select>
            <div className="view-toggle" role="tablist" aria-label="View toggle">
              <button className={`icon-btn ${view==='grid'?'active':''}`} title="Grid view" onClick={()=>setView('grid')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="13" y="3" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="3" y="13" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="13" y="13" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.5"/></svg>
              </button>
              <button className={`icon-btn ${view==='list'?'active':''}`} title="List view" onClick={()=>setView('list')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="5" width="16" height="3" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="4" y="10.5" width="16" height="3" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="4" y="16" width="16" height="3" rx="1" stroke="currentColor" strokeWidth="1.5"/></svg>
              </button>
            </div>
            <button className="btn add-btn" onClick={()=>setShowAdd(true)}><span className="icon">＋</span>Add Project</button>
          </div>
        </div>
      </header>

      {loading ? <div className="muted">Loading...</div> : (
        <section className={view==='grid'? 'project-cards':'project-list'}>
          {projects.map((p:any,i)=> (
            <article className={`project-card card ${view}`} key={p.id}>
              <div className="card-top">
                  <div className="icon-box">🏗️</div>
                  <div className={`status-tag ${String(p.status).replace(/\s+/g,'-')}`}>{p.status}</div>
                </div>
              <h3 className="proj-title">{p.title}</h3>
              <div className="proj-loc muted">{p.location}</div>
              <div className="progress-row">
                <div className="progress-label">Construction Progress</div>
                <div className="progress-pct">{p.progress}%</div>
              </div>
              <div className="progress"><div className="bar" style={{width:`${p.progress}%`}} /></div>
              <div className="dates muted">START: {p.start_date || '—'} <span className="sep">TARGET: {p.target_date || '—'}</span></div>
              <div className="card-bottom">
                <div>
                  <div className="muted small">CURRENT COST</div>
                  <div className="cost text-bold">{fmtUSD(p.cost||0)}</div>
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button className="btn btn-secondary" onClick={()=>navigate(`/projects/${p.id}`)}>View</button>
                  <button className="btn btn-secondary" onClick={()=>openEdit(p)}>Edit</button>
                  <button className="btn btn-danger" onClick={()=>handleDelete(p.id)}>Delete</button>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

      {/* Pagination footer for projects */}
      <div style={{paddingTop:16,display:'flex',justifyContent:'flex-end'}}>
        <div className="pagination">
          <button className="page-arrow" onClick={()=>setPage(p=>Math.max(1,p-1))} aria-label="Previous">‹</button>
          {getPageList(page, Math.max(1, Math.ceil(total / perPage))).map((item:any, idx:number)=> typeof item === 'string' ? (
            <span key={idx} className="page-ellipsis">{item}</span>
          ) : (
            <button key={item} className={`page-num ${item===page? 'active':''}`} onClick={()=>setPage(item)}>{item}</button>
          ))}
          <button className="page-arrow" onClick={()=>setPage(p=>Math.min(Math.max(1, Math.ceil(total / perPage)),p+1))} aria-label="Next">›</button>
        </div>
      </div>

      {showAdd && (
        <div className="modal-overlay">
          <div className="modal card">
            <h3>Add Project</h3>
            <form onSubmit={handleCreate} className="modal-form">
              <label>Title
                <input required placeholder="e.g., Riverside Tower Phase 3" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} className="input" />
                <div className="input-hint">Use the official project name or phase</div>
              </label>
              <label>Location
                <input placeholder="e.g., Quezon City, Metro Manila" value={form.location} onChange={e=>setForm({...form,location:e.target.value})} className="input" />
                <div className="input-hint">Include city, region, or site name</div>
              </label>
              <label>Cost (PHP)
                <input type="number" placeholder="e.g., 2450000" value={form.cost} onChange={e=>setForm({...form,cost:Number(e.target.value)})} className="input" />
                <div className="input-hint">Enter the total budget without commas or currency marks</div>
              </label>
              <label>Start date
                <input type="date" placeholder="e.g., 2026-06-24" value={form.start_date} onChange={e=>setForm({...form,start_date:e.target.value})} className="input date-input" />
                <div className="input-hint">Planned or actual kickoff date</div>
              </label>
              <label>Target date
                <input type="date" placeholder="e.g., 2027-02-15" value={form.target_date} onChange={e=>setForm({...form,target_date:e.target.value})} className="input date-input" />
                <div className="input-hint">Expected handoff or completion date</div>
              </label>
              <label>Status
                <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})} className="input">
                  <option>Initializing</option>
                  <option>On Schedule</option>
                  <option>At Risk</option>
                </select>
                <div className="input-hint">Pick the current project health</div>
              </label>
              <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                <button type="button" className="btn btn-secondary" onClick={()=>setShowAdd(false)}>Cancel</button>
                <button className="btn btn-primary" type="submit">Create</button>
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
                <input required placeholder="e.g., Riverside Tower Phase 3" value={editProject.title||''} onChange={e=>setEditProject({...editProject,title:e.target.value})} className="input" />
                <div className="input-hint">Use the official project name or phase</div>
              </label>
              <label>Location
                <input placeholder="e.g., Quezon City, Metro Manila" value={editProject.location||''} onChange={e=>setEditProject({...editProject,location:e.target.value})} className="input" />
                <div className="input-hint">Include city, region, or site name</div>
              </label>
              <label>Cost (PHP)
                <input type="number" placeholder="e.g., 2450000" value={editProject.cost||0} onChange={e=>setEditProject({...editProject,cost:Number(e.target.value)})} className="input" />
                <div className="input-hint">Enter the total budget without commas or currency marks</div>
              </label>
              <label>Start date
                <input type="date" placeholder="e.g., 2026-06-24" value={editProject.start_date||''} onChange={e=>setEditProject({...editProject,start_date:e.target.value})} className="input date-input" />
                <div className="input-hint">Planned or actual kickoff date</div>
              </label>
              <label>Target date
                <input type="date" placeholder="e.g., 2027-02-15" value={editProject.target_date||''} onChange={e=>setEditProject({...editProject,target_date:e.target.value})} className="input date-input" />
                <div className="input-hint">Expected handoff or completion date</div>
              </label>
              <label>Status
                <select value={editProject.status||'Initializing'} onChange={e=>setEditProject({...editProject,status:e.target.value})} className="input">
                  <option>Initializing</option>
                  <option>On Schedule</option>
                  <option>At Risk</option>
                </select>
                <div className="input-hint">Pick the current project health</div>
              </label>
              <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                <button type="button" className="btn btn-secondary" onClick={()=>{setShowEdit(false); setEditProject(null);}}>Cancel</button>
                <button className="btn btn-primary" type="submit">Save</button>
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
