import React, { useState, useEffect } from 'react';
import './Expenses.css';
import Sidebar from '../components/Sidebar';
import { formatPesoValue } from '../utils/formatCurrency';
import { authFetch } from '../services/auth';

type Expense = {
  id: string;
  date: string;
  project: string;
  category: string;
  description: string;
  amount: string;
  status: 'Recorded' | 'Pending Approval' | 'Rejected';
}

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

const sample: Expense[] = [];

export default function Expenses(): JSX.Element{
  const [items, setItems] = useState<Expense[]>(sample);
  const [date, setDate] = useState('2023-10-24');
  const [project, setProject] = useState('All Projects');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [form, setForm] = useState<any>({date:'', project:'', category:'', description:'', amount:0, status:'Recorded'});
  const [editItem, setEditItem] = useState<any>(null);

  useEffect(()=>{ fetchExpenses(); }, [page, perPage, date, project]);

  async function fetchExpenses(){
    setLoading(true);
    try{
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('perPage', String(perPage));
      if(project && project !== 'All Projects' && project !== 'All') params.set('project', project);
      if(date) params.set('date', date);
      const res = await authFetch(`${API_BASE}/api/expenses?${params.toString()}`);
      const json = await res.json();
      // server returns amount in cents - convert to formatted string
      const rows = (json.data || []).map((r:any) => ({ ...r, amount: formatPesoValue((r.amount||0)/100) }));
      setItems(rows);
      setTotal(json.total || 0);
    }catch(err){ console.error('fetch expenses', err); }
    setLoading(false);
  }

  function openEditExpense(it:any){ setEditItem(it); setShowEdit(true); }

  async function handleCreateExpense(e:any){ e && e.preventDefault && e.preventDefault();
    try{
      const payload = { ...form, amount: Number(form.amount) };
      const res = await authFetch(`${API_BASE}/api/expenses`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)});
      if(res.ok){ await fetchExpenses(); setShowAdd(false); setForm({date:'', project:'', category:'', description:'', amount:0, status:'Recorded'}); }
      else console.error('create expense failed');
    }catch(err){ console.error(err); }
  }

  async function handleEditExpense(e:any){ e && e.preventDefault && e.preventDefault(); if(!editItem) return; try{
    const payload = { ...editItem, amount: Number((editItem.amount||0)) };
    const res = await authFetch(`${API_BASE}/api/expenses/${editItem.id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)});
    if(res.ok){ await fetchExpenses(); setShowEdit(false); setEditItem(null); } else console.error('update expense failed');
  }catch(err){ console.error(err); }}

  async function handleDeleteExpense(id:any){ if(!window.confirm('Delete this expense?')) return; try{ const res = await authFetch(`${API_BASE}/api/expenses/${id}`, { method: 'DELETE' }); if(res.ok) await fetchExpenses(); else console.error('delete expense failed'); }catch(err){ console.error(err); } }
  return (
    <>
      <Sidebar />
      <main className="main">
        <div className="expenses-root">
          <div className="expenses-header">
        <div>
          <h1 className="expenses-title">Total Today's Expenses</h1>
          <div className="expenses-sub">Recorded Expenses</div>
        </div>
        <div className="expenses-controls">
          <input type="date" className="date-filter" value={date} onChange={e=>setDate(e.target.value)} />
          <select className="proj-filter" value={project} onChange={e=>setProject(e.target.value)}>
            <option>All Projects</option>
            <option>Skyline Residence Phase 2</option>
            <option>Central Plaza Renovation</option>
            <option>Warehouse Delta Construction</option>
          </select>
          <button className="btn add-exp" onClick={()=>setShowAdd(true)}>+ Add New</button>
        </div>
      </div>

      <div className="summary-cards">
        <div className="card small"> 
          <div className="label">Total Today's Expenses</div>
          <div className="value">₱4,280.50</div>
          <div className="delta">+12.5% from yesterday</div>
        </div>
        <div className="card small"> 
          <div className="label">Labor Costs</div>
          <div className="value small-val">₱2,100</div>
        </div>
        <div className="card small"> 
          <div className="label">Materials</div>
          <div className="value small-val">₱1,540</div>
        </div>
        <div className="card small"> 
          <div className="label">Others</div>
          <div className="value small-val">₱640</div>
        </div>
      </div>

      <div className="expenses-table-wrap">
        <div className="table-header">
          <h3>Recorded Expenses</h3>
          <div className="table-controls">
            <input type="date" className="inline-date" value={date} onChange={e=>setDate(e.target.value)} />
            <select className="proj-filter-small" value={project} onChange={e=>setProject(e.target.value)}>
              <option>All Projects</option>
              <option>Skyline Residence Phase 2</option>
              <option>Central Plaza Renovation</option>
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
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map(it=> (
              <tr key={it.id}>
                <td className="mono">{it.date}</td>
                <td className="strong">{it.project}</td>
                <td><span className="tag small">{it.category}</span></td>
                <td className="muted">{it.description}</td>
                <td className="amount">{it.amount}</td>
                <td><span className={`status ${it.status.replace(/\s+/g,'-')}`}>{it.status}</span></td>
                <td className="actions">
                  <button className="icon" title="Edit" onClick={()=>openEditExpense(it)}>✎</button>
                  <button className="icon" title="Delete" onClick={()=>handleDeleteExpense(it.id)}>🗑</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="table-footer">
          <div>Showing {(page-1)*perPage+1} - {Math.min(page*perPage, total)} of {total} recorded expenses</div>
          <div className="pagination small">
            <button className="page-arrow" onClick={()=>setPage(p=>Math.max(1,p-1))}>Previous</button>
            <button className="page-arrow" onClick={()=>setPage(p=>p+1)}>Next</button>
          </div>
        </div>
      </div>
      
      {showAdd && (
        <div className="modal-overlay">
          <div className="modal card">
            <h3>Add Expense</h3>
            <form onSubmit={handleCreateExpense} className="modal-form">
              <label>Date
                <input required type="date" value={form.date} onChange={e=>setForm({...form, date: e.target.value})} className="input" />
                <div className="input-hint">Use the actual spend date, e.g., 2026-06-24</div>
              </label>
              <label>Project
                <input required placeholder="e.g., Skyline Residence Phase 2" value={form.project} onChange={e=>setForm({...form, project: e.target.value})} className="input" />
                <div className="input-hint">Match the project name used in records</div>
              </label>
              <label>Category
                <input placeholder="e.g., Materials, Labor, Equipment" value={form.category} onChange={e=>setForm({...form, category: e.target.value})} className="input" />
                <div className="input-hint">Keep it short and consistent across entries</div>
              </label>
              <label>Description
                <input placeholder="e.g., Rebar delivery for Tower B" value={form.description} onChange={e=>setForm({...form, description: e.target.value})} className="input" />
                <div className="input-hint">Add a quick note about what was purchased</div>
              </label>
              <label>Amount (PHP)
                <input type="number" step="0.01" placeholder="e.g., 4280.50" value={form.amount} onChange={e=>setForm({...form, amount: Number(e.target.value)})} className="input" />
                <div className="input-hint">Enter the amount without the peso sign</div>
              </label>
              <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                <button type="button" className="btn btn-secondary" onClick={()=>setShowAdd(false)}>Cancel</button>
                <button className="btn btn-primary" type="submit">Create</button>
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
                <input required type="date" value={editItem.date} onChange={e=>setEditItem({...editItem, date: e.target.value})} className="input" />
                <div className="input-hint">Use the actual spend date, e.g., 2026-06-24</div>
              </label>
              <label>Project
                <input required placeholder="e.g., Skyline Residence Phase 2" value={editItem.project} onChange={e=>setEditItem({...editItem, project: e.target.value})} className="input" />
                <div className="input-hint">Match the project name used in records</div>
              </label>
              <label>Category
                <input placeholder="e.g., Materials, Labor, Equipment" value={editItem.category} onChange={e=>setEditItem({...editItem, category: e.target.value})} className="input" />
                <div className="input-hint">Keep it short and consistent across entries</div>
              </label>
              <label>Description
                <input placeholder="e.g., Rebar delivery for Tower B" value={editItem.description} onChange={e=>setEditItem({...editItem, description: e.target.value})} className="input" />
                <div className="input-hint">Add a quick note about what was purchased</div>
              </label>
              <label>Amount (PHP)
                <input type="number" step="0.01" placeholder="e.g., 4280.50" value={Number(editItem.amount||0)} onChange={e=>setEditItem({...editItem, amount: Number(e.target.value)})} className="input" />
                <div className="input-hint">Enter the amount without the peso sign</div>
              </label>
              <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                <button type="button" className="btn btn-secondary" onClick={()=>{setShowEdit(false); setEditItem(null);}}>Cancel</button>
                <button className="btn btn-primary" type="submit">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
        </div>
      </main>
    </>
  )
}
