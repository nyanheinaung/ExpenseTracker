'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import Flash from '@/components/Flash';
import { useApp } from '@/components/AppProvider';
import { ConfirmSheet } from '@/components/Sheet';
import { IconLeft } from '@/components/Icons';
import { friendlyError, supabase } from '@/lib/supabase';
import type { Category } from '@/lib/types';

export default function CategoriesPage() {
  const router = useRouter();
  const { sheet, categories, isOwner, refreshCategories } = useApp();
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Category | null>(null);

  const loadCounts = useCallback(async () => {
    const { data } = await supabase().rpc('category_counts');
    setCounts(new Map(((data as { category_id: string; n: number }[]) ?? []).map((r) => [r.category_id, Number(r.n)])));
  }, []);
  useEffect(() => {
    loadCounts();
  }, [loadCounts, categories]);

  const editable = categories.filter((c) => !c.is_system);
  const plural = (n: number) => (n === 1 ? '1 expense' : `${n} expenses`);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const n = newName.trim();
    if (!n) return setError('Type a category name first.');
    if (n.length > 30) return setError('Keep category names under 30 characters.');
    if (categories.some((c) => c.name.toLowerCase() === n.toLowerCase())) return setError('That category already exists.');
    if (!sheet) return;
    setBusy(true);
    const maxOrder = Math.max(0, ...editable.map((c) => c.sort_order));
    const { error } = await supabase().from('categories').insert({ sheet_id: sheet.id, name: n, sort_order: maxOrder + 1 });
    setBusy(false);
    if (error) return setError(friendlyError(error));
    setNewName('');
    await refreshCategories();
    setMessage(`“${n}” added`);
  }

  async function remove() {
    if (!pending) return;
    const c = pending;
    setBusy(true);
    const { data, error } = await supabase().rpc('remove_category', { target_id: c.id });
    setBusy(false);
    setPending(null);
    if (error) return setError(friendlyError(error));
    await refreshCategories();
    const moved = Number(data ?? 0);
    setMessage(moved > 0 ? `“${c.name}” removed. ${plural(moved)} moved to Other.` : `“${c.name}” removed`);
  }

  return (
    <AppShell>
      <Flash message={message} />
      <div className="back-head">
        <button className="icon-btn" aria-label="Back to settings" onClick={() => router.push('/settings')}><IconLeft /></button>
        <h1 className="title" style={{ fontSize: 20 }}>Categories</h1>
      </div>
      <div className="stack-lg">
        {isOwner ? (
          <form className="field" onSubmit={add} noValidate>
            <label className="label" htmlFor="newcat">Add a category</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input id="newcat" className="input" placeholder="e.g. Tools" maxLength={30} value={newName} onChange={(e) => { setNewName(e.target.value); setError(''); }} />
              <button className="btn btn-primary" disabled={busy}>Add</button>
            </div>
            {error && <p className="error-text" role="alert">{error}</p>}
          </form>
        ) : (
          <p className="notice-ok" style={{ margin: 0 }}>Only the sheet owner can add or remove categories.</p>
        )}

        <section aria-labelledby="c-list">
          <h2 className="section-label" id="c-list">Your categories</h2>
          <div className="list">
            {editable.map((c) => {
              const n = counts.get(c.id) ?? 0;
              return (
                <div key={c.id} className="list-row">
                  <span>
                    <span className="row-main">{c.name}</span>
                    <span className="row-sub">{n === 0 ? 'No expenses yet' : plural(n)}</span>
                  </span>
                  {isOwner && (
                    <button className="btn btn-warn-outline btn-small" aria-label={`Remove ${c.name}`} onClick={() => setPending(c)}>Remove</button>
                  )}
                </div>
              );
            })}
            {editable.length === 0 && <div className="empty">No categories yet. Everything goes to Other.</div>}
          </div>
          <p className="help" style={{ marginTop: 8 }}>Removing a category moves its expenses to Other.</p>
        </section>
      </div>

      <ConfirmSheet
        open={pending !== null}
        title={pending ? `Remove “${pending.name}”?` : ''}
        body={pending ? ((counts.get(pending.id) ?? 0) === 0 ? 'This category has no expenses, so nothing else will change.' : `Its ${plural(counts.get(pending.id) ?? 0)} will be moved to Other.`) : ''}
        confirmLabel="Remove"
        danger
        busy={busy}
        onCancel={() => setPending(null)}
        onConfirm={remove}
      />
    </AppShell>
  );
}
