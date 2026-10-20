'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase, friendlyError } from '@/lib/supabase';
import { useApp } from '@/components/AppProvider';
import { ConfirmSheet } from '@/components/Sheet';
import { IconClock } from '@/components/Icons';

type Req = { status: 'pending' | 'approved' | 'declined' | 'cancelled' | 'expired'; created_at: string } | null;

export default function WaitingPage() {
  const { profile, refreshAll, signOut } = useApp();
  const [req, setReq] = useState<Req>(null);
  const [loaded, setLoaded] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [checked, setChecked] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase().rpc('my_request');
    const rows = (data as Req[] | null) ?? [];
    setReq(rows[0] ?? null);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, [load, profile?.status]);

  async function checkAgain() {
    await refreshAll();
    await load();
    setChecked('Still waiting for approval.');
  }

  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>) {
    setError('');
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) {
      setError(friendlyError(error));
      return false;
    }
    await refreshAll();
    await load();
    return true;
  }

  if (!profile || !loaded) {
    return <div className="center-screen"><p className="muted">Loading…</p></div>;
  }

  if (profile.status === 'pending') {
    const date = req ? new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    return (
      <div className="auth stack-lg" style={{ textAlign: 'center', alignItems: 'center', minHeight: '100dvh', justifyContent: 'center' }}>
        <div style={{ width: 88, height: 88, borderRadius: 44, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconClock size={44} />
        </div>
        <h1 className="big-title">Waiting for approval</h1>
        <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>
          Your request has been sent to the sheet creator. You can start adding expenses as soon as they approve it.
        </p>
        {date && (
          <div className="card row-between" style={{ width: '100%', padding: '14px 16px' }}>
            <span className="muted">Requested</span>
            <span style={{ fontWeight: 600 }}>{date}</span>
          </div>
        )}
        <div role="status" className="muted small">{checked}</div>
        {error && <p className="error-text" role="alert">{error}</p>}
        <div className="stack" style={{ width: '100%', gap: 8 }}>
          <button className="btn btn-primary btn-big btn-block" onClick={checkAgain}>Check again</button>
          <button className="btn btn-secondary btn-block" onClick={() => setConfirmCancel(true)}>Cancel request</button>
          <button className="btn-text" onClick={signOut}>Sign out</button>
        </div>
        <ConfirmSheet
          open={confirmCancel}
          title="Cancel your request?"
          body="The sheet creator will no longer see it. You can send a new request or start your own sheet afterwards."
          confirmLabel="Cancel request"
          busy={busy}
          onCancel={() => setConfirmCancel(false)}
          onConfirm={async () => {
            if (await run(() => supabase().rpc('cancel_join_request'))) setConfirmCancel(false);
          }}
        />
      </div>
    );
  }

  // Not linked to any sheet.
  let message = 'Your account isn’t linked to a sheet yet.';
  if (req?.status === 'declined') message = 'Your request to join was declined.';
  else if (req?.status === 'expired') message = 'Your request expired before it was approved.';
  else if (req?.status === 'cancelled') message = 'You cancelled your request.';
  else if (req?.status === 'approved') message = 'You are no longer a member of your previous sheet.';

  return (
    <div className="auth stack-lg">
      <div>
        <h1 className="big-title">Choose a sheet</h1>
        <p className="muted" style={{ margin: '6px 0 0' }}>{message}</p>
      </div>
      <div className="card stack">
        <div className="field">
          <label className="label" htmlFor="creator">Join an existing sheet</label>
          <input id="creator" className="input" type="email" placeholder="Sheet creator’s email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <p className="help">The creator will be asked to approve you.</p>
        </div>
        <button
          className="btn btn-primary btn-block"
          disabled={busy}
          onClick={() => {
            if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email address.');
            run(() => supabase().rpc('request_join', { owner_email: email.trim() }));
          }}
        >
          Send request
        </button>
      </div>
      <div className="card stack">
        <div>
          <div className="label">Start my own sheet</div>
          <p className="help">You become its owner and can invite others.</p>
        </div>
        <button className="btn btn-secondary btn-block" disabled={busy} onClick={() => run(() => supabase().rpc('create_own_sheet'))}>
          Start my own sheet
        </button>
      </div>
      {error && <p className="error-text" role="alert">{error}</p>}
      <button className="btn-text" onClick={signOut}>Sign out</button>
    </div>
  );
}
