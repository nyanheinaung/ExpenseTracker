'use client';

import { useParams } from 'next/navigation';
import ExpenseForm from '@/components/ExpenseForm';

export default function EditExpensePage() {
  const params = useParams<{ id: string }>();
  return <ExpenseForm key={params.id} expenseId={params.id} />;
}
