'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import AppShell from '@/components/AppShell';
import Flash from '@/components/Flash';
import MonthPicker from '@/components/MonthPicker';
import { useApp } from '@/components/AppProvider';
import { useExpenseChanges } from '@/components/useExpenseChanges';
import { IconCalendar, IconLeft, IconRight } from '@/components/Icons';
import { fetchAll, friendlyError, supabase } from '@/lib/supabase';
import { MONTHS, SHORT_MONTHS, dayLabel, monthOf, monthRange, paymentLabel, tokyoYearMonth, yearRange, yen } from '@/lib/format';
import { downloadCsv } from '@/lib/csv';
import type { Expense } from '@/lib/types';

type Mode = 'month' | 'year';

export default function HistoryPage() {
  const { sheet, categories, people } = useApp();
  const [mode, setMode] = useState<Mode>('month');
  const [{ y, m }, setYM] = useState(tokyoYearMonth);
  const [items, setItems] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [picker, setPicker] = useState(false);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [who, setWho] = useState('all');

  const load = useCallback(async () => {
    setError('');
    const [start, end] = mode === 'month' ? monthRange(y, m) : yearRange(y);
    try {
      const rows = await fetchAll<Expense>((from, to) =>
        supabase()
          .from('expenses')
          .select('id,name,amount,category_id,payment_method,spent_on,created_by,created_at')
          .is('deleted_at', null)
          .gte('spent_on', start)
          .lt('spent_on', end)
          .order('spent_on', { ascending: false })
          .order('created_at', { ascending: false })
          .range(from, to)
      );
      setItems(rows);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, [mode, y, m]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);
  useExpenseChanges(sheet?.id, load);

  const catName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const personName = useMemo(() => new Map(people.map((p) => [p.id, p.display_name])), [people]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter(
      (it) =>
        (cat === 'all' || it.category_id === cat) &&
        (who === 'all' || it.created_by === who) &&
        (term === '' || it.name.toLowerCase().includes(term))
    );
  }, [items, q, cat, who]);

  const total = filtered.reduce((a, b) => a + b.amount, 0);
  const isFiltered = cat !== 'all' || who !== 'all' || q.trim() !== '';

  const groups = useMemo(() => {
    const out: { day: string; rows: Expense[] }[] = [];
    filtered.forEach((it) => {
      const last = out[out.length - 1];
      if (last && last.day === it.spent_on) last.rows.push(it);
      else out.push({ day: it.spent_on, rows: [it] });
    });
    return out;
  }, [filtered]);

  const yearRows = useMemo(() => {
    const sums = Array(12).fill(0) as number[];
    const any = Array(12).fill(false) as boolean[];
    items.forEach((it) => (any[monthOf(it.spent_on)] = true));
    filtered.forEach((it) => (sums[monthOf(it.spent_on)] += it.amount));
    const max = Math.max(1, ...sums);
    return sums.map((s, i) => ({ i, sum: s, has: any[i], w: (s / max) * 100 }));
  }, [items, filtered]);

  const step = (d: number) => {
    if (mode === 'year') return setYM({ y: y + d, m });
    let nm = m + d, ny = y;
    if (nm < 0) { nm = 11; ny--; }
    if (nm > 11) { nm = 0; ny++; }
    setYM({ y: ny, m: nm });
  };

  function exportCsv() {
    const period = mode === 'month' ? `${y}-${String(m + 1).padStart(2, '0')}` : String(y);
    const safe = (sheet?.name ?? 'sheet').replace(/[\\/:*?"<>|\s]+/g, '-');
    const rows = filtered
      .slice()
      .sort((a, b) => a.spent_on.localeCompare(b.spent_on))
      .map((it) => [
        it.spent_on,
        it.name,
        catName.get(it.category_id) ?? 'Other',
        paymentLabel(it.payment_method),
        it.amount,
        personName.get(it.created_by) ?? 'Former member',
        new Date(it.created_at).toLocaleString('en-CA', { timeZone: 'Asia/Tokyo', hour12: false })
      ]);
    downloadCsv(`expenses_${safe}_${period}.csv`, ['Date', 'Name', 'Category', 'Payment', 'Amount', 'Entered by', 'Created at'], rows);
  }

  const periodLabel = mode === 'month' ? `${SHORT_MONTHS[m]} ${y}` : String(y);

  return (
    <AppShell>
      <Flash />
      <div className="page-head" style={{ marginBottom: 12 }}>
        <h1 className="title">History</h1>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button className="icon-btn plain" aria-label={mode === 'month' ? 'Previous month' : 'Previous year'} onClick={() => step(-1)}><IconLeft /></button>
          <button className="period-btn" onClick={() => setPicker(true)} aria-label={`Choose month or year, now showing ${mode === 'month' ? MONTHS[m] + ' ' + y : y}`}>
            {periodLabel} <IconCalendar size={16} />
          </button>
          <button className="icon-btn plain" aria-label={mode === 'month' ? 'Next month' : 'Next year'} onClick={() => step(1)}><IconRight /></button>
        </div>
      </div>

      <div className="history-tools">
        <div className="seg" role="group" aria-label="View">
          <button aria-pressed={mode === 'month'} onClick={() => setMode('month')}>Monthly</button>
          <button aria-pressed={mode === 'year'} onClick={() => setMode('year')}>Yearly</button>
        </div>
        <label htmlFor="search" className="visually-hidden">Search by name</label>
        <input id="search" className="input" type="search" placeholder="Search names" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="grid-2">
          <div className="field" style={{ gap: 4 }}>
            <label htmlFor="f-cat" className="small" style={{ fontWeight: 600, color: 'var(--muted)' }}>Category</label>
            <select id="f-cat" className={`select${cat !== 'all' ? ' active' : ''}`} value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="all">All</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ gap: 4 }}>
            <label htmlFor="f-who" className="small" style={{ fontWeight: 600, color: 'var(--muted)' }}>Member</label>
            <select id="f-who" className={`select${who !== 'all' ? ' active' : ''}`} value={who} onChange={(e) => setWho(e.target.value)}>
              <option value="all">All</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.display_name}{p.is_current ? '' : ' (former)'}</option>)}
            </select>
          </div>
        </div>
        <div className="row-between small" style={{ minHeight: 32 }}>
          <span className="muted" role="status">{loading ? 'Loading…' : `${filtered.length} ${filtered.length === 1 ? 'item' : 'items'}, ${yen(total)}`}</span>
          <span style={{ display: 'flex', gap: 12 }}>
            {isFiltered && <button className="btn-text small" onClick={() => { setQ(''); setCat('all'); setWho('all'); }}>Clear filters</button>}
            {filtered.length > 0 && <button className="btn-text small" onClick={exportCsv}>Download CSV</button>}
          </span>
        </div>
      </div>

      {error && <p className="error-text" role="alert">{error}</p>}

      {mode === 'month' ? (
        <div className="stack" style={{ gap: 14 }}>
          {groups.map((g) => (
            <section key={g.day} aria-label={dayLabel(g.day)}>
              <h2 className="day-label">{dayLabel(g.day)}</h2>
              <div className="list">
                {g.rows.map((it) => (
                  <Link key={it.id} href={`/expense/${it.id}`} className="list-row">
                    <span>
                      <span className="row-main">{it.name}</span>
                      <span className="row-sub">
                        {catName.get(it.category_id) ?? 'Other'}, {paymentLabel(it.payment_method)}, {personName.get(it.created_by) ?? 'Former member'}
                      </span>
                    </span>
                    <span className="amount">{yen(it.amount)}</span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
          {!loading && groups.length === 0 && (
            <div className="list"><div className="empty">{isFiltered ? 'No expenses match these filters.' : 'No expenses this month yet.'}</div></div>
          )}
        </div>
      ) : (
        <>
          <div className="list">
            {yearRows.map((r) =>
              r.has ? (
                <button key={r.i} className="list-row month-bar-row" onClick={() => { setYM({ y, m: r.i }); setMode('month'); }}>
                  <span className="row-between"><span>{MONTHS[r.i]}</span><span className="amount">{yen(r.sum)}</span></span>
                  <span className="bar thin" aria-hidden="true"><span style={{ width: `${r.w}%` }} /></span>
                </button>
              ) : (
                <div key={r.i} className="list-row muted"><span>{MONTHS[r.i]}</span><span>–</span></div>
              )
            )}
          </div>
          <p className="muted small" style={{ textAlign: 'center' }}>Tap a month to see its expenses.</p>
        </>
      )}

      <MonthPicker
        open={picker}
        year={y}
        month={mode === 'month' ? m : null}
        onClose={() => setPicker(false)}
        onPick={(ny, nm) => { setYM({ y: ny, m: nm }); setMode('month'); setPicker(false); }}
        extra={{ label: (py) => `Show the whole year ${py}`, onClick: (py) => { setYM({ y: py, m }); setMode('year'); setPicker(false); } }}
      />
    </AppShell>
  );
}
