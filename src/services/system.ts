import { authFetch } from './auth';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';

export type MaterialCategoryOption = {
  name: string;
  description?: string;
};

export type SystemOptions = {
  materials_categories: MaterialCategoryOption[];
  daily_expense_categories: string[];
  supplier_categories: string[];
  user_roles: string[];
  project_statuses: string[];
  payment_statuses: string[];
  unit_categories: string[];
  transaction_types: string[];
  report_types: string[];
};

const defaultOptions: SystemOptions = {
  materials_categories: [],
  daily_expense_categories: [],
  supplier_categories: [],
  user_roles: [],
  project_statuses: [],
  payment_statuses: [],
  unit_categories: [],
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
      supplier_categories: json.supplier_categories || [],
      user_roles: json.user_roles || [],
      project_statuses: json.project_statuses || [],
      payment_statuses: json.payment_statuses || [],
      unit_categories: json.unit_categories || [],
      transaction_types: json.transaction_types || [],
      report_types: json.report_types || [],
    };
  } catch (error) {
    console.error('system options fetch', error);
    return defaultOptions;
  }
}
