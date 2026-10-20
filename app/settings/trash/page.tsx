'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import AppShell from '@/components/AppShell';
import Flash from '@/components/Flash';
import { useApp } from '@/components/AppProvider';
import { useExpenseChanges } from '@/components/useExpenseChanges';
import { IconLeft } from '@/components/Icons';
import { fetchAll, friendlyError, supabase } from '@/lib/supabase';
import { shortDate, yen } from '@/lib/format';
import type { Expense } from '@/lib/types';

export default function TrashPage() {
  const router = useRouter();
  const { sheet, people, userId, isOwner } = useApp();
  const [items, setItems] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    try {
      const rows = await fetchAll<Expense>((from, to) =>
        supabase()
          .from('expenses')
          .select('id,name,amount,category_id,payment_method,spent_on,created_by,created_at,deleted_at,deleted_by')
          .not('deleted_at', 'is', null)
          .order('deleted_at', { ascending: false })
          .range(from, to)
      );
      setItems(rows);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  useExpenseChanges(sheet?.id, load);

  const personName = useMemo(() => new Map(people.map((p) => [p.id, p.display_name])), [people]);

  async function restore(it: Expense) {
    setError('');
    setBusyId(it.id);
    const { error, data } = await supabase().from('expenses').update({ deleted_at: null }).eq('id', it.id).select('id');
    setBusyId('');
    if (error || !data?.length) return setError(error ? friendlyError(error) : 'You don’t have permission to restore this expense.');
    setMessage(`“${it.name}” restored`);
    load();
  }

  return (
    <AppShell>
      <Flash message={message} />
      <div className="back-head">
        <button className="icon-btn" aria-label="Back to settings" onClick={() => router.push('/settings')}><IconLeft /></button>
        <h1 className="title" style={{ fontSize: 20 }}>Trash</h1>
      </div>
      <p className="help" style={{ marginBottom: 16 }}>Removed expenses stay here and don’t count in totals. Restore puts them back.</p>
      {error && <p className="error-text" role="alert">{error}</p>}
      <div className="list">
        {items.map((it) => {
          const can = it.created_by === userId || isOwner;
          return (
            <div key={it.id} className="list-row">
              <span>
                <span className="row-main">{it.name}, {yen(it.amount)}</span>
                <span className="row-sub">{shortDate(it.spent_on)}, entered by {personName.get(it.created_by) ?? 'former member'}</span>
              </span>
              {can && (
                <button className="btn btn-secondary btn-small" disabled={busyId === it.id} onClick={() => restore(it)}>
                  {busyId === it.id ? 'Restoring…' : 'Restore'}
                </button>
              )}
            </div>
          );
        })}
        {!loading && items.length === 0 && <div className="empty">Trash is empty.</div>}
        {loading && <div className="empty">Loading…</div>}
      </div>
    </AppShell>
  );
}
