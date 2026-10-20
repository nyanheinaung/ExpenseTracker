'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { setFlash } from '@/lib/names';
import { useApp } from '@/components/AppProvider';

export default function UpdatePasswordPage() {
  const router = useRouter();
  const { userId, ready } = useApp();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError('Use a password of at least 8 characters.');
    setBusy(true);
    const { error } = await supabase().auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(error.message);
    setFlash('Password changed');
    router.replace('/');
  }

  if (ready && !userId) {
    return (
      <div className="auth stack-lg">
        <h1 className="big-title">Link expired</h1>
        <p className="muted" style={{ margin: 0 }}>This password link is no longer valid. Request a new one.</p>
        <a className="btn btn-primary btn-block" href="/forgot">Request a new link</a>
      </div>
    );
  }

  return (
    <div className="auth">
      <form className="stack-lg" onSubmit={submit} noValidate>
        <h1 className="big-title">Set a new password</h1>
        <div className="field">
          <label className="label" htmlFor="password">New password</label>
          <input id="password" className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <p className="help">At least 8 characters.</p>
        </div>
        {error && <p className="error-text" role="alert">{error}</p>}
        <button className="btn btn-primary btn-big btn-block" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
      </form>
    </div>
  );
}
