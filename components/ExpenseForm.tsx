'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from './AppShell';
import { useApp } from './AppProvider';
import { ConfirmSheet } from './Sheet';
import { IconCheck, IconClock, IconLeft } from './Icons';
import { friendlyError, supabase } from '@/lib/supabase';
import { PAYMENTS, parseAmount, tokyoToday } from '@/lib/format';
import { loadLastUsed, loadNames, matchNames, rememberName, saveLastUsed, setFlash } from '@/lib/names';
import type { Expense, Payment } from '@/lib/types';

function goBack(router: ReturnType<typeof useRouter>) {
  if (window.history.length > 1) router.back();
  else router.push('/');
}

export default function ExpenseForm({ expenseId }: { expenseId?: string }) {
  const router = useRouter();
  const { userId, sheet, categories, isOwner } = useApp();
  const editing = Boolean(expenseId);

  const [original, setOriginal] = useState<Expense | null>(null);
  const [loadError, setLoadError] = useState('');
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [payment, setPayment] = useState<Payment>('cash');
  const [date, setDate] = useState(tokyoToday());
  const [errors, setErrors] = useState<{ name?: string; note?: string; amount?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const [saved, setSaved] = useState<string[]>([]);
  const [showSug, setShowSug] = useState(false);
  const [hl, setHl] = useState(-1);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (userId) setSaved(loadNames(userId));
  }, [userId]);

  // Defaults for a new expense: last used category and payment on this device.
  useEffect(() => {
    if (editing || !userId || categories.length === 0 || categoryId) return;
    const last = loadLastUsed(userId);
    setCategoryId(categories.some((c) => c.id === last.categoryId) ? (last.categoryId as string) : categories[0].id);
    if (last.payment && PAYMENTS.some((p) => p.value === last.payment)) setPayment(last.payment as Payment);
  }, [editing, userId, categories, categoryId]);

  // Load the expense being edited.
  useEffect(() => {
    if (!expenseId) return;
    supabase()
      .from('expenses')
      .select('id,name,note,amount,category_id,payment_method,spent_on,created_by,created_at,deleted_at')
      .eq('id', expenseId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
          setLoadError('This expense could not be found.');
          return;
        }
        const e = data as Expense;
        setOriginal(e);
        setName(e.name);
        setNote(e.note ?? '');
        setAmount(e.amount.toLocaleString('en-US'));
        setCategoryId(e.category_id);
        setPayment(e.payment_method);
        setDate(e.spent_on);
      });
  }, [expenseId]);

  const canEdit = !editing || (original !== null && !original.deleted_at && (original.created_by === userId || isOwner));
  const suggestions = useMemo(() => matchNames(saved, name), [saved, name]);
  const open = showSug && suggestions.length > 0 && canEdit;

  function pick(n: string) {
    setName(n);
    setShowSug(false);
    setHl(-1);
    setErrors((e) => ({ ...e, name: undefined }));
  }

  async function save() {
    const errs: typeof errors = {};
    const n = name.trim();
    const a = parseAmount(amount);
    if (!n) errs.name = 'Please enter a name for this expense.';
    else if (n.length > 100) errs.name = 'Keep the name under 100 characters.';
    const nt = note.trim();
    if (nt.length > 200) errs.note = 'Keep the note under 200 characters.';
    if (!amount.trim()) errs.amount = 'Please enter an amount.';
    else if (!Number.isFinite(a) || a <= 0) errs.amount = 'Enter the amount in whole yen, like 1240.';
    else if (a > 99999999) errs.amount = 'That amount is too large.';
    if (!date) errs.form = 'Choose a date.';
    if (!categoryId) errs.form = 'Choose a category.';
    setErrors(errs);
    if (Object.keys(errs).length || !userId || !sheet) return;

    setBusy(true);
    const row = { name: n, note: nt || null, amount: a, category_id: categoryId, payment_method: payment, spent_on: date };
    const res = editing
      ? await supabase().from('expenses').update(row).eq('id', expenseId as string).select('id')
      : await supabase().from('expenses').insert({ ...row, sheet_id: sheet.id, created_by: userId }).select('id');
    setBusy(false);
    if (res.error || !res.data?.length) {
      setErrors({ form: res.error ? friendlyError(res.error) : 'You don’t have permission to change this expense.' });
      return;
    }
    rememberName(userId, n);
    saveLastUsed(userId, { categoryId, payment });
    setFlash(editing ? 'Changes saved' : 'Saved');
    goBack(router);
  }

  async function remove() {
    setBusy(true);
    const { error, data } = await supabase()
      .from('expenses')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', expenseId as string)
      .select('id');
    setBusy(false);
    if (error || !data?.length) {
      setConfirmRemove(false);
      setErrors({ form: error ? friendlyError(error) : 'You don’t have permission to remove this expense.' });
      return;
    }
    setFlash('Moved to Trash');
    goBack(router);
  }

  const title = editing ? (canEdit ? 'Edit expense' : 'Expense') : 'Add expense';

  return (
    <AppShell bare>
      <div className="back-head">
        <button className="icon-btn" aria-label="Back" onClick={() => goBack(router)}><IconLeft /></button>
        <h1 className="title" style={{ fontSize: 20 }}>{title}</h1>
      </div>

      {loadError ? (
        <p className="error-text" role="alert">{loadError}</p>
      ) : editing && !original ? (
        <p className="muted">Loading…</p>
      ) : (
        <form className="stack-lg" onSubmit={(e) => { e.preventDefault(); save(); }} noValidate>
          {editing && !canEdit && (
            <p className="notice-ok" style={{ margin: 0 }}>
              {original?.deleted_at ? 'This expense is in Trash. Restore it from Settings → Trash to change it.' : 'Only the person who entered this expense, or the sheet owner, can change it.'}
            </p>
          )}

          <div className="field">
            <label className="label" htmlFor="name">Name <span className="opt">(required)</span></label>
            <div className="suggest-wrap">
              <input
                id="name"
                className="input"
                style={{ fontSize: 18, minHeight: 56 }}
                autoComplete="off"
                placeholder="e.g. Train fare"
                maxLength={100}
                disabled={!canEdit}
                value={name}
                role="combobox"
                aria-expanded={open}
                aria-controls="name-suggestions"
                aria-autocomplete="list"
                aria-invalid={errors.name ? 'true' : 'false'}
                aria-describedby={errors.name ? 'name-error' : undefined}
                onChange={(e) => { setName(e.target.value); setShowSug(true); setHl(-1); setErrors((x) => ({ ...x, name: undefined })); }}
                onFocus={() => setShowSug(true)}
                onBlur={() => { blurTimer.current = setTimeout(() => setShowSug(false), 150); }}
                onKeyDown={(e) => {
                  if (!open) return;
                  if (e.key === 'ArrowDown') { e.preventDefault(); setHl((h) => Math.min(h + 1, suggestions.length - 1)); }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); setHl((h) => Math.max(h - 1, 0)); }
                  else if (e.key === 'Enter' && hl >= 0) { e.preventDefault(); pick(suggestions[hl]); }
                  else if (e.key === 'Escape') setShowSug(false);
                }}
              />
              {open && (
                <ul className="suggest" id="name-suggestions" role="listbox" aria-label="Names you used before">
                  {suggestions.map((s, i) => (
                    <li key={s} role="option" aria-selected={i === hl}>
                      <button
                        type="button"
                        tabIndex={-1}
                        className={i === hl ? 'hl' : undefined}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pick(s)}
                      >
                        <span className="muted" style={{ display: 'flex' }}><IconClock /></span>
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {errors.name && <p className="error-text" id="name-error">{errors.name}</p>}
          </div>

          <div className="field">
            <label className="label" htmlFor="note">Note <span className="opt">(optional)</span></label>
            <input
              id="note"
              className="input"
              autoComplete="off"
              placeholder="e.g. Shinjuku → Shibuya"
              maxLength={200}
              disabled={!canEdit}
              value={note}
              aria-invalid={errors.note ? 'true' : 'false'}
              aria-describedby={errors.note ? 'note-error' : undefined}
              onChange={(e) => { setNote(e.target.value); setErrors((x) => ({ ...x, note: undefined })); }}
            />
            {errors.note && <p className="error-text" id="note-error">{errors.note}</p>}
          </div>

          <div className="field">
            <div className="amount-box">
              <label className="small muted" htmlFor="amount">Amount</label>
              <div className="amount-row">
                <span className="amount-yen" aria-hidden="true">¥</span>
                <input
                  id="amount"
                  className="amount-input"
                  inputMode="numeric"
                  placeholder="0"
                  disabled={!canEdit}
                  value={amount}
                  aria-invalid={errors.amount ? 'true' : 'false'}
                  aria-describedby={errors.amount ? 'amount-error' : undefined}
                  onChange={(e) => { setAmount(e.target.value); setErrors((x) => ({ ...x, amount: undefined })); }}
                  onBlur={() => { const v = parseAmount(amount); if (Number.isFinite(v)) setAmount(v.toLocaleString('en-US')); }}
                />
              </div>
            </div>
            {errors.amount && <p className="error-text" id="amount-error">{errors.amount}</p>}
          </div>

          <fieldset className="field" style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend className="label" style={{ marginBottom: 10 }}>Category</legend>
            <div className="grid-3">
              {categories.map((c) => (
                <button type="button" key={c.id} className="chip" aria-pressed={categoryId === c.id} disabled={!canEdit} onClick={() => setCategoryId(c.id)}>
                  {c.name}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="field" style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend className="label" style={{ marginBottom: 10 }}>Paid by</legend>
            <div className="grid-3">
              {PAYMENTS.map((p) => (
                <button type="button" key={p.value} className="chip soft" aria-pressed={payment === p.value} disabled={!canEdit} onClick={() => setPayment(p.value)}>
                  {p.label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="field">
            <label className="label" htmlFor="date">Date</label>
            <input id="date" className="input" type="date" value={date} disabled={!canEdit} onChange={(e) => setDate(e.target.value)} />
          </div>

          {errors.form && <p className="error-text" role="alert">{errors.form}</p>}

          {canEdit && (
            <div className="save-dock">
              <div className="save-dock-inner">
                {editing && (
                  <button type="button" className="btn btn-warn-outline" onClick={() => setConfirmRemove(true)} disabled={busy}>Remove</button>
                )}
                <button type="submit" className="btn btn-primary btn-big" style={{ flex: 1 }} disabled={busy}>
                  <IconCheck />{busy ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          )}
        </form>
      )}

      <ConfirmSheet
        open={confirmRemove}
        title="Move this expense to Trash?"
        body="It will no longer count in totals. You can restore it any time from Settings → Trash."
        confirmLabel="Move to Trash"
        danger
        busy={busy}
        onCancel={() => setConfirmRemove(false)}
        onConfirm={remove}
      />
    </AppShell>
  );
}
