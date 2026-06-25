import { useEffect, useMemo, useState } from 'react';
import './Materials.css';
import Sidebar from '../components/Sidebar';
import { formatPesoValue } from '../utils/formatCurrency';
import { authFetch } from '../services/auth';
import { useNavigate } from 'react-router-dom';
import { fetchSystemOptions } from '../services/system';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';

type Material = {
  id: number;
  code: string | null;
  name: string;
  category: string | null;
  quantity: string | null;
  unit: string | null;
  cost: string | null;
  supplier: string | null;
  supplier_category: string | null;
  low_stock?: boolean;
};

type Category = {
  id: number;
  name: string;
  description?: string | null;
};

const blankMaterial = {
  name: '',
  category: '',
  quantity: '',
  unit: '',
  cost: '',
  supplier: '',
  supplier_category: '',
  low_stock: false,
};

function parseCost(value: string | null | undefined) {
  const numeric = Number.parseFloat(String(value ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(numeric) ? numeric : 0;
}

function quantityLabel(material: Pick<Material, 'quantity' | 'unit'>) {
  const quantity = material.quantity?.trim() || '-';
  const unit = material.unit?.trim();
  return unit ? `${quantity} ${unit}` : quantity;
}

export default function Materials() {
  const navigate = useNavigate();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [unitOptions, setUnitOptions] = useState<string[]>([]);
  const [supplierCategoryOptions, setSupplierCategoryOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<Material | null>(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [form, setForm] = useState(blankMaterial);
  const [editItem, setEditItem] = useState<Material | null>(null);
  const [saving, setSaving] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  useEffect(() => {
    void fetchMaterials();
  }, [page, perPage, category, search]);

  useEffect(() => {
    void Promise.all([fetchCategories(), loadSystemOptions()]);
  }, []);

  async function loadSystemOptions() {
    const options = await fetchSystemOptions();
    setUnitOptions(options.unit_categories);
    setSupplierCategoryOptions(options.supplier_categories);
  }

  async function fetchCategories() {
    try {
      const res = await authFetch(`${API_BASE}/api/categories`);
      const json = await res.json();
      setCategories(json.data || []);
    } catch (err) {
      console.error('categories fetch', err);
    }
  }

  async function fetchMaterials() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('perPage', String(perPage));
      if (category && category !== 'All') params.set('category', category);
      if (search) params.set('search', search);
      const res = await authFetch(`${API_BASE}/api/materials?${params.toString()}`);
      const json = await res.json();
      setMaterials(json.data || []);
      setTotal(json.total || 0);
    } catch (err) {
      console.error('materials fetch', err);
    }
    setLoading(false);
  }

  const visibleValue = useMemo(
    () => materials.reduce((sum, material) => sum + parseCost(material.cost), 0),
    [materials],
  );

  const lowStockCount = useMemo(
    () => materials.filter((material) => material.low_stock).length,
    [materials],
  );

  const categoryOptions = useMemo(() => ['All', ...categories.map((categoryItem) => categoryItem.name)], [categories]);

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

  function openDrawer(material: Material) {
    setSelected(material);
    setDrawerOpen(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await authFetch(`${API_BASE}/api/materials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowAdd(false);
        setForm(blankMaterial);
        await fetchMaterials();
      }
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  }

  function openEdit(material: Material) {
    setEditItem(material);
    setShowEdit(true);
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editItem) return;
    setSaving(true);
    try {
      const res = await authFetch(`${API_BASE}/api/materials/${editItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editItem),
      });
      if (res.ok) {
        setShowEdit(false);
        setEditItem(null);
        await fetchMaterials();
      }
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  }

  async function handleDelete(id: number) {
    if (!window.confirm('Delete this material?')) return;
    try {
      const res = await authFetch(`${API_BASE}/api/materials/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (selected?.id === id) {
          setDrawerOpen(false);
          setSelected(null);
        }
        await fetchMaterials();
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
        <div className="materials-root">
          <div className="materials-header">
            <div>
              <h1 className="materials-title">Materials Inventory</h1>
              <div className="materials-sub">Standardized construction materials, units, and supplier types for your inventory workflow.</div>
            </div>

            <div className="materials-controls">
              <input
                className="filter"
                placeholder="Search materials..."
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applySearch();
                }}
              />
              <select className="filter" value={String(perPage)} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}>
                <option value="10">Show 10</option>
                <option value="25">Show 25</option>
                <option value="50">Show 50</option>
                <option value="100">Show 100</option>
              </select>
              <select className="filter" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
                {categoryOptions.map((value) => <option key={value}>{value}</option>)}
              </select>
              <button className="btn add" onClick={applySearch} type="button">Search</button>
              <button className="btn add" onClick={() => navigate('/categories')} type="button">Manage Categories</button>
              <button className="btn add" onClick={() => setShowAdd(true)} type="button">Add Material</button>
            </div>
          </div>

          <div className="stats-row">
            <div className="stat-card">
              <div className="label">VISIBLE MATERIALS</div>
              <div className="value">{materials.length}</div>
              <div className="delta">Current page</div>
            </div>
            <div className="stat-card">
              <div className="label">LOW STOCK ALERTS</div>
              <div className="value danger">{lowStockCount}</div>
            </div>
            <div className="stat-card">
              <div className="label">TOTAL RECORDS</div>
              <div className="value">{total}</div>
            </div>
            <div className="stat-card">
              <div className="label">VISIBLE INVENTORY VALUE</div>
              <div className="value">{formatPesoValue(visibleValue)}</div>
            </div>
          </div>

          <div className="materials-table-wrap">
            <table className="materials-table">
              <thead>
                <tr>
                  <th>ITEM NAME</th>
                  <th>CATEGORY</th>
                  <th>QUANTITY</th>
                  <th>COST PRICE</th>
                  <th>SUPPLIER</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="muted">Loading materials...</td>
                  </tr>
                ) : materials.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="muted">No materials found yet.</td>
                  </tr>
                ) : materials.map((material) => (
                  <tr key={material.id}>
                    <td className="strong">{material.name}</td>
                    <td><span className="tag">{material.category || 'UNCATEGORIZED'}</span></td>
                    <td className={material.low_stock ? 'lowstock' : ''}>
                      {quantityLabel(material)}
                      {material.low_stock ? <div className="low-note">LOW STOCK</div> : null}
                    </td>
                    <td className="mono">{formatPesoValue(parseCost(material.cost))}</td>
                    <td>{material.supplier || '-'}</td>
                    <td className="actions">
                      <button className="icon" title="Details" onClick={() => openDrawer(material)} type="button">Info</button>
                      <button className="icon action-edit" title="Edit" onClick={() => openEdit(material)} type="button">Edit</button>
                      <button className="icon action-delete" title="Delete" onClick={() => handleDelete(material.id)} type="button">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="table-footer">
              <div className="table-summary">Showing {total === 0 ? 0 : (page - 1) * perPage + 1}-{Math.min(page * perPage, total)} of {total} materials</div>
              <div className="pagination">
                <button className="page-arrow" onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="Previous">&lt;</button>
                {getPageList(page, totalPages).map((item, idx) => {
                  if (typeof item === 'string') return <span key={`el-${idx}`} className="page-ellipsis">{item}</span>;
                  return <button key={item} className={`page-num ${item === page ? 'active' : ''}`} onClick={() => setPage(item)}>{item}</button>;
                })}
                <button className="page-arrow" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} aria-label="Next">&gt;</button>
              </div>
            </div>
          </div>

          {showAdd && (
            <div className="modal-overlay">
              <div className="modal card">
                <h3>Add Material</h3>
                <form onSubmit={handleCreate} className="modal-form">
                  <label>Name
                    <input required placeholder="e.g., Portland Cement" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" />
                  </label>
                  <label>Category
                    <select required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input">
                      <option value="">Select category</option>
                      {categories.map((categoryItem) => <option key={categoryItem.id} value={categoryItem.name}>{categoryItem.name}</option>)}
                    </select>
                  </label>
                  <label>Quantity
                    <input placeholder="e.g., 10" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="input" />
                  </label>
                  <label>Unit
                    <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="input">
                      <option value="">Select unit</option>
                      {unitOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  <label>Cost
                    <input placeholder="e.g., 12" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} className="input" />
                  </label>
                  <label>Supplier
                    <input placeholder="e.g., Akyatan Trading" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} className="input" />
                  </label>
                  <label>Supplier Category
                    <select value={form.supplier_category} onChange={(e) => setForm({ ...form, supplier_category: e.target.value })} className="input">
                      <option value="">Select supplier category</option>
                      {supplierCategoryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  <label className="checkbox-row">
                    <input type="checkbox" checked={form.low_stock} onChange={(e) => setForm({ ...form, low_stock: e.target.checked })} />
                    <span>Mark as low stock</span>
                  </label>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
                    <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Create'}</button>
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
                  <label>Name
                    <input required value={editItem.name || ''} onChange={(e) => setEditItem({ ...editItem, name: e.target.value })} className="input" />
                  </label>
                  <label>Category
                    <select required value={editItem.category || ''} onChange={(e) => setEditItem({ ...editItem, category: e.target.value })} className="input">
                      <option value="">Select category</option>
                      {categories.map((categoryItem) => <option key={categoryItem.id} value={categoryItem.name}>{categoryItem.name}</option>)}
                    </select>
                  </label>
                  <label>Quantity
                    <input value={editItem.quantity || ''} onChange={(e) => setEditItem({ ...editItem, quantity: e.target.value })} className="input" />
                  </label>
                  <label>Unit
                    <select value={editItem.unit || ''} onChange={(e) => setEditItem({ ...editItem, unit: e.target.value })} className="input">
                      <option value="">Select unit</option>
                      {unitOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  <label>Cost
                    <input value={editItem.cost || ''} onChange={(e) => setEditItem({ ...editItem, cost: e.target.value })} className="input" />
                  </label>
                  <label>Supplier
                    <input value={editItem.supplier || ''} onChange={(e) => setEditItem({ ...editItem, supplier: e.target.value })} className="input" />
                  </label>
                  <label>Supplier Category
                    <select value={editItem.supplier_category || ''} onChange={(e) => setEditItem({ ...editItem, supplier_category: e.target.value })} className="input">
                      <option value="">Select supplier category</option>
                      {supplierCategoryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  <label className="checkbox-row">
                    <input type="checkbox" checked={Boolean(editItem.low_stock)} onChange={(e) => setEditItem({ ...editItem, low_stock: e.target.checked })} />
                    <span>Mark as low stock</span>
                  </label>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => { setShowEdit(false); setEditItem(null); }}>Cancel</button>
                    <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {drawerOpen && selected && (
            <aside className="drawer">
              <div className="drawer-header">
                <div>
                  <div className="drawer-title">Material Details</div>
                  <div className="drawer-sub">{selected.name}</div>
                </div>
                <button className="close" onClick={() => setDrawerOpen(false)} type="button">X</button>
              </div>

              <div className="drawer-list">
                <div className="purchase">
                  <div className="p-title">Category</div>
                  <div className="p-sub">{selected.category || 'Uncategorized'}</div>
                </div>
                <div className="purchase">
                  <div className="p-title">Quantity</div>
                  <div className="p-sub">{quantityLabel(selected)}</div>
                </div>
                <div className="purchase">
                  <div className="p-title">Unit Cost</div>
                  <div className="p-sub">{formatPesoValue(parseCost(selected.cost))}</div>
                </div>
                <div className="purchase">
                  <div className="p-title">Supplier</div>
                  <div className="p-sub">{selected.supplier || '-'}</div>
                </div>
                <div className="purchase">
                  <div className="p-title">Supplier Category</div>
                  <div className="p-sub">{selected.supplier_category || '-'}</div>
                </div>
              </div>

              <div className="drawer-footer">
                <div className="current-inv">LOW STOCK <span className="mono">{selected.low_stock ? 'YES' : 'NO'}</span></div>
                <button className="btn report" type="button" onClick={() => openEdit(selected)}>Edit Material</button>
              </div>
            </aside>
          )}
        </div>
      </main>
    </>
  );
}
