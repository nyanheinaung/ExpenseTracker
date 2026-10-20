export type Profile = {
  id: string;
  email: string;
  display_name: string;
  sheet_id: string | null;
  role: 'owner' | 'member' | null;
  status: 'pending' | 'active' | 'unbound';
};

export type Sheet = { id: string; name: string; monthly_budget: number | null; owner_id: string };

export type Category = { id: string; name: string; is_system: boolean; sort_order: number };

export type Person = { id: string; display_name: string; email: string; role: 'owner' | 'member' | null; is_current: boolean };

export type JoinRequest = { id: string; display_name: string; email: string; created_at: string };

export type Payment = 'cash' | 'card' | 'transfer';

export type Expense = {
  id: string;
  name: string;
  amount: number;
  category_id: string;
  payment_method: Payment;
  spent_on: string;
  created_by: string;
  created_at: string;
  deleted_at?: string | null;
  deleted_by?: string | null;
};
