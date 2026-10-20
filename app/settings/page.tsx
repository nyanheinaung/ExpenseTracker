'use client';

import Link from 'next/link';
import { useState } from 'react';
import AppShell from '@/components/AppShell';
import Flash from '@/components/Flash';
import { useApp } from '@/components/AppProvider';
import { ConfirmSheet } from '@/components/Sheet';
import { IconRight } from '@/components/Icons';
import { friendlyError, supabase } from '@/lib/supabase';
import { parseAmount, yen } from '@/lib/format';
import type { Person } from '@/lib/types';

type Pending = { kind: 'remove' | 'transfer' | 'decline'; id: string; name: string } | null;

export default function SettingsPage() {
  const { profile, sheet, people, requests, isOwner, userId, refreshSheet, refreshPeople, refreshRequests, refreshAll, signOut } = useApp();
  const [editing, setEditing] = useState<'name' | 'budget' | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending>(null);

  const members = people.filter((p) => p.is_current);

  async function saveField() {
    setError('');
    if (!sheet) return;
    let patch: { name?: string; monthly_budget?: number | null } = {};
    if (editing === 'name') {
      const n = draft.trim();
      if (!n || n.length > 60) return setError('Use 1 to 60 characters for the sheet name.');
      patch = { name: n };
    } else {
      if (draft.trim() === '') patch = { monthly_budget: null };
      else {
        const v = parseAmount(draft);
        if (!Number.isFinite(v)) return setError('Enter the budget in whole yen, like 250000.');
        patch = { monthly_budget: v };
      }
    }
    setBusy(true);
    const { error } = await supabase().from('sheets').update(patch).eq('id', sheet.id);
    setBusy(false);
    if (error) return setError(friendlyError(error));
    await refreshSheet();
    setEditing(null);
    setMessage('Saved');
  }

  async function respond(id: string, approve: boolean) {
    setError('');
    setBusy(true);
    const { error } = await supabase().rpc('respond_join', { request_id: id, approve });
    setBusy(false);
    if (error) return setError(friendlyError(error));
    await Promise.all([refreshRequests(), refreshPeople()]);
    setMessage(approve ? 'Request approved' : 'Request declined');
  }

  async function confirmPending() {
    if (!pending) return;
    if (pending.kind === 'decline') {
      await respond(pending.id, false);
      setPending(null);
      return;
    }
    setError('');
    setBusy(true);
    const { error } =
      pending.kind === 'remove'
        ? await supabase().rpc('remove_member', { member_id: pending.id })
        : await supabase().rpc('transfer_ownership', { member_id: pending.id });
    setBusy(false);
    setPending(null);
    if (error) return setError(friendlyError(error));
    await Promise.all([refreshPeople(), refreshAll()]);
    setMessage(pending.kind === 'remove' ? `${pending.name} removed from the sheet` : `${pending.name} is now the owner`);
  }

  const confirmText = (p: Exclude<Pending, null>) =>
    p.kind === 'remove'
      ? { title: `Remove ${p.name}?`, body: `${p.name} will no longer see this sheet. Expenses they entered stay in the sheet.`, label: 'Remove' }
      : p.kind === 'transfer'
        ? { title: `Make ${p.name} the owner?`, body: `${p.name} will manage members, categories and the budget. You will become a member. New people will join using ${p.name}’s email.`, label: 'Make owner' }
        : { title: `Decline ${p.name}?`, body: `${p.name} will not be able to see this sheet.`, label: 'Decline' };

  const row = (label: string, value: string, field: 'name' | 'budget', initial: string) =>
    editing === field ? (
      <form className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }} onSubmit={(e) => { e.preventDefault(); saveField(); }}>
        <label className="label" htmlFor={`f-${field}`}>{label}</label>
        <input id={`f-${field}`} className="input" autoFocus inputMode={field === 'budget' ? 'numeric' : undefined} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={field === 'budget' ? 'Leave blank for no budget' : undefined} />
        <div className="two-buttons">
          <button type="button" className="btn btn-secondary" onClick={() => { setEditing(null); setError(''); }}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>Save</button>
        </div>
      </form>
    ) : isOwner ? (
      <button className="list-row" onClick={() => { setEditing(field); setDraft(initial); setError(''); }}>
        <span>{label}</span><span className="muted">{value}</span>
      </button>
    ) : (
      <div className="list-row"><span>{label}</span><span className="muted">{value}</span></div>
    );

  const memberRow = (p: Person) => (
    <div key={p.id} className="list-row" style={{ flexWrap: 'wrap' }}>
      <span>
        <span className="row-main">{p.display_name}{p.id === userId ? ' (you)' : ''}</span>
        <span className="row-sub">{p.email}</span>
      </span>
      {p.role === 'owner' ? (
        <span className="pill">Owner</span>
      ) : isOwner ? (
        <span style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-secondary btn-small" onClick={() => setPending({ kind: 'transfer', id: p.id, name: p.display_name })}>Make owner</button>
          <button className="btn btn-warn-outline btn-small" onClick={() => setPending({ kind: 'remove', id: p.id, name: p.display_name })}>Remove</button>
        </span>
      ) : (
        <span className="muted small">Member</span>
      )}
    </div>
  );

  return (
    <AppShell>
      <Flash message={message} />
      <div className="page-head"><h1 className="title">Settings</h1></div>
      <div className="stack-lg">
        {isOwner && requests.map((r) => (
          <section key={r.id} className="notice-warn stack" style={{ gap: 12 }} aria-label="Join request">
            <div className="small" style={{ fontWeight: 600, color: 'var(--warn)' }}>Join request</div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 600 }}>{r.display_name}</div>
              <div className="muted small">{r.email} wants to join this sheet</div>
            </div>
            <div className="two-buttons">
              <button className="btn btn-secondary" disabled={busy} onClick={() => setPending({ kind: 'decline', id: r.id, name: r.display_name })}>Decline</button>
              <button className="btn btn-primary" disabled={busy} onClick={() => respond(r.id, true)}>Approve</button>
            </div>
          </section>
        ))}

        {error && <p className="error-text" role="alert">{error}</p>}

        <section aria-labelledby="s-sheet">
          <h2 className="section-label" id="s-sheet">Sheet</h2>
          <div className="list">
            {row('Sheet name', sheet?.name ?? '', 'name', sheet?.name ?? '')}
            {row('Monthly budget', sheet?.monthly_budget != null ? yen(sheet.monthly_budget) : 'Not set', 'budget', sheet?.monthly_budget != null ? String(sheet.monthly_budget) : '')}
            <Link href="/settings/categories" className="list-row"><span>Categories</span><IconRight size={18} /></Link>
          </div>
          {!isOwner && <p className="help" style={{ marginTop: 8 }}>Only the owner can change the sheet settings.</p>}
        </section>

        <section aria-labelledby="s-members">
          <h2 className="section-label" id="s-members">Members</h2>
          <div className="list">{members.map(memberRow)}</div>
        </section>

        <section aria-labelledby="s-data">
          <h2 className="section-label" id="s-data">Data</h2>
          <div className="list">
            <Link href="/settings/trash" className="list-row"><span>Trash, restore removed items</span><IconRight size={18} /></Link>
            <Link href="/history" className="list-row"><span>Download CSV (from History)</span><IconRight size={18} /></Link>
          </div>
        </section>

        <section aria-labelledby="s-account">
          <h2 className="section-label" id="s-account">Account</h2>
          <div className="list">
            <div className="list-row">
              <span><span className="row-main">{profile?.display_name}</span><span className="row-sub">{profile?.email}</span></span>
            </div>
            <button className="list-row" onClick={signOut} style={{ color: 'var(--accent)', fontWeight: 600 }}>Sign out</button>
          </div>
        </section>
      </div>

      {pending && (
        <ConfirmSheet
          open
          title={confirmText(pending).title}
          body={confirmText(pending).body}
          confirmLabel={confirmText(pending).label}
          danger={pending.kind !== 'transfer'}
          busy={busy}
          onCancel={() => setPending(null)}
          onConfirm={confirmPending}
        />
      )}
    </AppShell>
  );
}
