import { authFetch } from './auth';

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');

export type MaterialCategoryOption = {
  name: string;
  description?: string;
};

export type SystemOptionRecord = {
  name: string;
  status: 'Active' | 'Inactive';
};

export type SystemOptions = {
  materials_categories: MaterialCategoryOption[];
  daily_expense_categories: string[];
  daily_expense_category_records: SystemOptionRecord[];
  supplier_categories: string[];
  user_roles: string[];
  project_statuses: string[];
  project_status_records: SystemOptionRecord[];
  payment_statuses: string[];
  unit_categories: string[];
  unit_category_records: SystemOptionRecord[];
  transaction_types: string[];
  report_types: string[];
};

const defaultOptions: SystemOptions = {
  materials_categories: [],
  daily_expense_categories: [],
  daily_expense_category_records: [],
  supplier_categories: [],
  user_roles: [],
  project_statuses: [],
  project_status_records: [],
  payment_statuses: [],
  unit_categories: [],
  unit_category_records: [],
  transaction_types: [],
  report_types: [],
};

export async function fetchSystemOptions(): Promise<SystemOptions> {
  try {
    const response = await authFetch(`${API_BASE}/api/system/options`);
    if (!response.ok) return defaultOptions;
    const json = await response.json();
    return {
      materials_categories: json.materials_categories || [],
      daily_expense_categories: json.daily_expense_categories || [],
      daily_expense_category_records: json.daily_expense_category_records || [],
      supplier_categories: json.supplier_categories || [],
      user_roles: json.user_roles || [],
      project_statuses: json.project_statuses || [],
      project_status_records: json.project_status_records || [],
      payment_statuses: json.payment_statuses || [],
      unit_categories: json.unit_categories || [],
      unit_category_records: json.unit_category_records || [],
      transaction_types: json.transaction_types || [],
      report_types: json.report_types || [],
    };
  } catch (error) {
    console.error('system options fetch', error);
    return defaultOptions;
  }
}
