import React, { useState, useEffect } from 'react';
import './Materials.css';
import Sidebar from '../components/Sidebar';
import { formatPesoValue } from '../utils/formatCurrency';
import { authFetch } from '../services/auth';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

type Material = {
  id?: string | number;
  code: string;
  name: string;
  category: string;
  quantity: string;
  cost: string;
  supplier: string;
  lowStock?: boolean;
}

const initial: Material[] = [
  { code: 'CEM001', name: 'Portland Cement (Type I)', category: 'STRUCTURAL', quantity: '1,200 Bags', cost: formatPesoValue(8.50), supplier: 'Global Concr. Inc.' },
  { code: 'STB-12M', name: 'Deformed Steel Bars (12mm)', category: 'STRUCTURAL', quantity: '150 Tons', cost: formatPesoValue(640.00), supplier: 'Metro Steel Mill', lowStock:true },
  { code: 'PPR-20L', name: 'PPR Pipes (20mm, 4m)', category: 'PLUMBING', quantity: '450 Units', cost: formatPesoValue(12.20), supplier: 'AquaFlow Systems' },
  { code: 'VNY-FLR', name: 'Luxury Vinyl Flooring Tiles', category: 'FINISHING', quantity: '2,800 SqFt', cost: formatPesoValue(3.15), supplier: 'Interior Decor Ltd' },
]

function fmtNumber(n:number){
  if(n>=1000000) return `${(n/1000000).toFixed(1)}M`;
  if(n>=1000) return `${Math.round(n/1000)},000`;
  return String(n);
}

export default function Materials(): JSX.Element{
  const [materials, setMaterials] = useState<Material[]>(initial);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<Material | null>(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [total, setTotal] = useState(0);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [form, setForm] = useState<Material | null>(null);
  const [editItem, setEditItem] = useState<Material | null>(null);
  const [editKey, setEditKey] = useState<string | number | null>(null);

  // When server provides paged results, `materials` already contains the current page.
  // Fall back to client-side slicing when `total` is 0 (no server paging yet).
  const pagedMaterials = (total && total > 0) ? materials : materials.slice((page - 1) * perPage, page * perPage);

  function getPageList(cur: number, total: number){
    if(total <= 7){
      return Array.from({length: total}, (_,i)=>i+1);
    }
    const pages: (number|string)[] = [];
    pages.push(1);
    let left = Math.max(2, cur-1);
    let right = Math.min(total-1, cur+1);
    if(left > 2) pages.push('...');
    for(let p = left; p <= right; p++) pages.push(p);
    if(right < total-1) pages.push('...');
    pages.push(total);
    return pages;
  }

  function openDrawer(m: Material){ setSelected(m); setDrawerOpen(true); }

  async function fetchMaterials(){
    try{
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('perPage', String(perPage));
      const res = await authFetch(`${API_BASE}/api/materials?${params.toString()}`);
      const json = await res.json();
      setMaterials(json.data || []);
      setTotal(json.total || 0);
    }catch(err){ console.error('materials fetch', err); }
  }

  React.useEffect(()=>{ fetchMaterials(); }, [page, perPage]);
  
  useEffect(()=>{ if(!showAdd) setForm(null); }, [showAdd]);

  async function handleCreate(e:any){
    e && e.preventDefault && e.preventDefault();
    if(!form) return;
    try{
      const res = await authFetch(`${API_BASE}/api/materials`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(form)});
      if(res.ok){
        const created = await res.json();
        // if server paging is on, refetch; otherwise prepend
        if(total && total > 0) fetchMaterials(); else setMaterials(prev=>[created, ...prev]);
        setShowAdd(false);
        setForm(null);
      } else {
        console.error('create material failed');
      }
    }catch(err){ console.error(err); }
  }

  function openEdit(m: Material){
    setEditItem(m);
    setEditKey(m.id ?? m.code);
    setShowEdit(true);
  }

  async function handleEditSubmit(e:any){
    e && e.preventDefault && e.preventDefault();
    if(!editItem) return;
    try{
      if(editItem.id != null){
        const res = await authFetch(`${API_BASE}/api/materials/${editItem.id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(editItem)});
        if(res.ok){
          const updated = await res.json();
          setMaterials(prev => prev.map(m => (m.id === updated.id ? updated : m)));
          setShowEdit(false);
          setEditItem(null);
          setEditKey(null);
        } else console.error('update failed');
      } else if(editKey != null){
        setMaterials(prev => prev.map(m => ((m.id ?? m.code) === editKey ? { ...m, ...editItem } : m)));
        setShowEdit(false);
        setEditItem(null);
        setEditKey(null);
      }
    }catch(err){ console.error(err); }
  }

  async function handleDelete(idOrCode:any){
    if(!window.confirm('Delete this material?')) return;
    if(typeof idOrCode === 'number' || (typeof idOrCode === 'string' && /^\d+$/.test(idOrCode))){
      try{
        const res = await authFetch(`${API_BASE}/api/materials/${idOrCode}`, { method: 'DELETE' });
        if(res.ok){ setMaterials(prev => prev.filter(m => m.id !== idOrCode)); }
        else console.error('delete failed');
      }catch(err){ console.error(err); }
      return;
    }

    setMaterials(prev => prev.filter(m => (m.id ?? m.code) !== idOrCode));
  }

  return (
    <>
      <Sidebar />
      <main className="main">
        <div className="materials-root">
      <div className="materials-header">
        <div>
          <h1 className="materials-title">Materials Inventory</h1>
          <div className="materials-sub">Central registry for all structural and finishing materials.</div>
        </div>

        <div className="materials-controls">
            <select className="filter" value={String(perPage)} onChange={e=>{ setPerPage(Number(e.target.value)); setPage(1); }}>
              <option value="10">Show 10</option>
              <option value="25">Show 25</option>
              <option value="50">Show 50</option>
              <option value="100">Show 100</option>
            </select>
            <select className="filter">
              <option>All Categories</option>
              <option>Structural</option>
              <option>Plumbing</option>
              <option>Finishing</option>
            </select>
            <button className="btn add" onClick={()=>setShowAdd(true)}>+ Add Material</button>
          </div>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <div className="label">TOTAL SKU</div>
          <div className="value">{fmtNumber(1284)}</div>
          <div className="delta">+12%</div>
        </div>
        <div className="stat-card">
          <div className="label">LOW STOCK ALERTS</div>
          <div className="value danger">24 <span className="badge">ACTION</span></div>
        </div>
        <div className="stat-card">
          <div className="label">PENDING ORDERS</div>
          <div className="value">8</div>
        </div>
        <div className="stat-card">
          <div className="label">INVENTORY VALUE</div>
          <div className="value">{formatPesoValue(4200000)}</div>
        </div>
      </div>

      <div className="materials-table-wrap">
        <table className="materials-table">
          <thead>
            <tr>
              <th>ITEM CODE</th>
              <th>ITEM NAME</th>
              <th>CATEGORY</th>
              <th>QUANTITY</th>
              <th>COST PRICE</th>
              <th>SUPPLIER</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {pagedMaterials.map((m)=> (
              <tr key={m.id ?? m.code}>
                <td className="mono">{m.code}</td>
                <td className="strong">{m.name}</td>
                <td><span className="tag">{m.category}</span></td>
                <td className={m.lowStock? 'lowstock':''}>{m.quantity}{m.lowStock? <div className="low-note">LOW STOCK</div>:null}</td>
                <td className="mono">{m.cost}</td>
                <td>{m.supplier}</td>
                <td className="actions">
                  <button className="icon" title="History" onClick={()=>openDrawer(m)}>⟳</button>
                  <button className="icon action-edit" title="Edit" onClick={()=>openEdit(m)}>✎</button>
                  <button className="icon action-delete" title="Delete" onClick={()=>handleDelete(m.id ?? m.code)}>🗑</button>
                  {!(m as any).id ? <span className="muted small">(local)</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="table-footer">
          <div className="table-summary">Showing {(page-1)*perPage+1}-{Math.min(page*perPage,total)} of {total} materials</div>
          <div className="pagination">
            <button className="page-arrow" onClick={()=>setPage(p=>Math.max(1,p-1))} aria-label="Previous">‹</button>
            {getPageList(page, totalPages).map((item, idx)=>{
              if(typeof item === 'string') return <span key={`el-${idx}`} className="page-ellipsis">{item}</span>;
              return <button key={item} className={`page-num ${item===page? 'active':''}`} onClick={()=>setPage(item)}>{item}</button>
            })}
            <button className="page-arrow" onClick={()=>setPage(p=>Math.min(totalPages,p+1))} aria-label="Next">›</button>
          </div>
        </div>
      </div>

      {showAdd && (
        <div className="modal-overlay">
          <div className="modal card">
            <h3>Add Material</h3>
            <form onSubmit={handleCreate} className="modal-form">
              <label>Item Code
                <input required placeholder="e.g., CEM001" value={form?.code||''} onChange={e=>setForm({...form, code: e.target.value} as Material)} className="input" />
                <div className="input-hint">Use uppercase code, e.g., CEM001</div>
              </label>
              <label>Name
                <input required placeholder="e.g., Portland Cement (Type I)" value={form?.name||''} onChange={e=>setForm({...form, name: e.target.value} as Material)} className="input" />
                <div className="input-hint">Full item name helps searches</div>
              </label>
              <label>Category
                <input placeholder="e.g., STRUCTURAL" value={form?.category||''} onChange={e=>setForm({...form, category: e.target.value} as Material)} className="input" />
                <div className="input-hint">Category should be a short word (STRUCTURAL, PLUMBING)</div>
              </label>
              <label>Quantity
                <input placeholder="e.g., 1,200 Bags" value={form?.quantity||''} onChange={e=>setForm({...form, quantity: e.target.value} as Material)} className="input" />
                <div className="input-hint">Use units in text, e.g., "1,200 Bags" or "150 Tons"</div>
              </label>
              <label>Cost
                <input placeholder="e.g., 8.50" value={form?.cost||''} onChange={e=>setForm({...form, cost: e.target.value} as Material)} className="input" />
                <div className="input-hint">Enter numeric cost in PHP (no currency symbol). Example: 8.50</div>
              </label>
              <label>Supplier
                <input placeholder="e.g., Global Concr. Inc." value={form?.supplier||''} onChange={e=>setForm({...form, supplier: e.target.value} as Material)} className="input" />
                <div className="input-hint">Supplier name or company</div>
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
            <h3>Edit Material</h3>
            <form onSubmit={handleEditSubmit} className="modal-form">
              <label>Item Code
                <input required placeholder="e.g., CEM001" value={(editItem as any).code||''} onChange={e=>setEditItem({...editItem, code: e.target.value} as Material)} className="input" />
                <div className="input-hint">Use uppercase code, e.g., CEM001</div>
              </label>
              <label>Name
                <input required placeholder="e.g., Portland Cement (Type I)" value={(editItem as any).name||''} onChange={e=>setEditItem({...editItem, name: e.target.value} as Material)} className="input" />
                <div className="input-hint">Full item name helps searches</div>
              </label>
              <label>Category
                <input placeholder="e.g., STRUCTURAL" value={(editItem as any).category||''} onChange={e=>setEditItem({...editItem, category: e.target.value} as Material)} className="input" />
                <div className="input-hint">Category should be a short word (STRUCTURAL, PLUMBING)</div>
              </label>
              <label>Quantity
                <input placeholder="e.g., 1,200 Bags" value={(editItem as any).quantity||''} onChange={e=>setEditItem({...editItem, quantity: e.target.value} as Material)} className="input" />
                <div className="input-hint">Use units in text, e.g., "1,200 Bags" or "150 Tons"</div>
              </label>
              <label>Cost
                <input placeholder="e.g., 8.50" value={(editItem as any).cost||''} onChange={e=>setEditItem({...editItem, cost: e.target.value} as Material)} className="input" />
                <div className="input-hint">Enter numeric cost in PHP (no currency symbol). Example: 8.50</div>
              </label>
              <label>Supplier
                <input placeholder="e.g., Global Concr. Inc." value={(editItem as any).supplier||''} onChange={e=>setEditItem({...editItem, supplier: e.target.value} as Material)} className="input" />
                <div className="input-hint">Supplier name or company</div>
              </label>
              <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                <button type="button" className="btn btn-secondary" onClick={()=>{setShowEdit(false); setEditItem(null);}}>Cancel</button>
                <button className="btn btn-primary" type="submit">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {drawerOpen && selected && (
        <aside className="drawer">
          <div className="drawer-header">
            <div>
              <div className="drawer-title">Purchase History</div>
              <div className="drawer-sub mono">{selected.code} | {selected.name}</div>
            </div>
            <button className="close" onClick={()=>setDrawerOpen(false)}>✕</button>
          </div>

          <div className="drawer-list">
            <div className="purchase">
              <div className="p-title">Batch #PO-9923</div>
              <div className="p-sub">Purchased 500 Bags @ {formatPesoValue(8.20)}/ea</div>
              <div className="p-date">Oct 24, 2023</div>
            </div>
            <div className="purchase">
              <div className="p-title">Batch #PO-8812</div>
              <div className="p-sub">Purchased 700 Bags @ {formatPesoValue(8.50)}/ea</div>
              <div className="p-date">Aug 12, 2023</div>
            </div>
            <div className="purchase">
              <div className="p-title">Batch #PO-7231</div>
              <div className="p-sub">Purchased 400 Bags @ {formatPesoValue(8.45)}/ea</div>
              <div className="p-date">May 05, 2023</div>
            </div>
          </div>

          <div className="drawer-footer">
            <div className="current-inv">CURRENT INVENTORY <span className="mono">1,200 Bags</span></div>
            <button className="btn report">Generate Stock Report</button>
          </div>
        </aside>
      )}
        </div>
      </main>
    </>
  )
}
