'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import AppShell from '@/components/AppShell';
import Flash from '@/components/Flash';
import MonthPicker from '@/components/MonthPicker';
import { useApp } from '@/components/AppProvider';
import { useExpenseChanges } from '@/components/useExpenseChanges';
import { IconCalendar, IconLeft, IconPlus, IconRight } from '@/components/Icons';
import { fetchAll, friendlyError, supabase } from '@/lib/supabase';
import { MONTHS, monthRange, shortDate, tokyoYearMonth, yen } from '@/lib/format';
import type { Expense } from '@/lib/types';

export default function HomePage() {
  const { sheet, categories, people } = useApp();
  const [{ y, m }, setYM] = useState(tokyoYearMonth);
  const [items, setItems] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [picker, setPicker] = useState(false);

  const load = useCallback(async () => {
    setError('');
    const [start, end] = monthRange(y, m);
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
  }, [y, m]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);
  useExpenseChanges(sheet?.id, load);

  const catName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const personName = useMemo(() => new Map(people.map((p) => [p.id, p.display_name])), [people]);
  const total = items.reduce((a, b) => a + b.amount, 0);
  const budget = sheet?.monthly_budget ?? null;
  const byCat = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((it) => map.set(it.category_id, (map.get(it.category_id) ?? 0) + it.amount));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);

  const step = (d: number) => {
    let nm = m + d, ny = y;
    if (nm < 0) { nm = 11; ny--; }
    if (nm > 11) { nm = 0; ny++; }
    setYM({ y: ny, m: nm });
  };
  const now = tokyoYearMonth();

  return (
    <AppShell dock>
      <Flash />
      <div>
        <div className="page-head">
          <div className="month-head" style={{ flex: 1, maxWidth: 520 }}>
            <button className="icon-btn" aria-label="Previous month" onClick={() => step(-1)}><IconLeft /></button>
            <button className="month-btn" onClick={() => setPicker(true)} aria-label={`Choose month, now showing ${MONTHS[m]} ${y}`}>
              <span className="month-btn-label">{MONTHS[m]} {y} <IconCalendar /></span>
              <span className="month-btn-sub">{sheet?.name}</span>
            </button>
            <button className="icon-btn" aria-label="Next month" onClick={() => step(1)}><IconRight /></button>
          </div>
          <Link href="/expense/new" className="btn btn-primary add-desktop"><IconPlus size={20} />Add expense</Link>
        </div>

        {error && <p className="error-text" role="alert">{error}</p>}

        <div className="home-grid">
          <div className="stack">
            <section className="card" aria-label="This month’s total">
              <div className="spent-label">Spent this month</div>
              <div className="spent-amount">{loading ? '…' : yen(total)}</div>
              {budget !== null && budget > 0 && (
                <>
                  <div className={`bar${total > budget ? ' over' : ''}`}>
                    <span style={{ width: `${Math.min(100, (total / budget) * 100)}%` }} />
                  </div>
                  <div className="row-between small" style={{ marginTop: 10 }}>
                    <span className="muted">Budget {yen(budget)}</span>
                    {total <= budget ? (
                      <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{yen(budget - total)} left</span>
                    ) : (
                      <span style={{ fontWeight: 600, color: 'var(--warn)' }}>{yen(total - budget)} over budget</span>
                    )}
                  </div>
                </>
              )}
            </section>

            <section className="home-latest" aria-label="Latest expenses">
              <div className="row-between" style={{ marginBottom: 8 }}>
                <h2 className="section-label" style={{ margin: 0, color: 'var(--ink)', fontSize: 16 }}>Latest</h2>
                <Link href="/history" className="btn-text" style={{ textDecoration: 'none' }}>See all</Link>
              </div>
              {items.length === 0 ? (
                <div className="list"><div className="empty">{loading ? 'Loading…' : 'No expenses this month yet.'}</div></div>
              ) : (
                <div className="list">
                  {items.slice(0, 6).map((it) => (
                    <Link key={it.id} href={`/expense/${it.id}`} className="list-row">
                      <span>
                        <span className="row-main">{it.name}</span>
                        <span className="row-sub">{shortDate(it.spent_on)}, {personName.get(it.created_by) ?? 'Former member'}</span>
                      </span>
                      <span className="amount">{yen(it.amount)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="card stack" aria-label="Spending by category">
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>By category</h2>
            {byCat.length === 0 && <p className="muted" style={{ margin: 0 }}>{loading ? 'Loading…' : 'Nothing spent yet.'}</p>}
            {byCat.map(([id, sum]) => (
              <div className="cat-line" key={id}>
                <div className="row-between"><span>{catName.get(id) ?? 'Other'}</span><span className="amount">{yen(sum)}</span></div>
                <div className="bar thin"><span style={{ width: `${(sum / total) * 100}%` }} /></div>
              </div>
            ))}
          </section>
        </div>
      </div>

      <div className="add-dock">
        <Link href="/expense/new" className="btn btn-primary btn-big btn-block"><IconPlus />Add expense</Link>
      </div>

      <MonthPicker
        open={picker}
        year={y}
        month={m}
        onClose={() => setPicker(false)}
        onPick={(ny, nm) => { setYM({ y: ny, m: nm }); setPicker(false); }}
        extra={{ label: () => 'Back to this month', onClick: () => { setYM(now); setPicker(false); } }}
      />
    </AppShell>
  );
}
