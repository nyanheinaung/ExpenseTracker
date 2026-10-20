'use client';

import Link from 'next/link';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function ForgotPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email address.');
    setBusy(true);
    const { error } = await supabase().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/update-password`
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div className="auth">
      {sent ? (
        <div className="stack-lg">
          <h1 className="big-title">Check your email</h1>
          <p className="muted" style={{ margin: 0 }}>If an account exists for {email.trim()}, a link to set a new password is on its way.</p>
          <Link href="/login" className="btn btn-secondary btn-block">Back to sign in</Link>
        </div>
      ) : (
        <form className="stack-lg" onSubmit={submit} noValidate>
          <h1 className="big-title">Reset your password</h1>
          <div className="field">
            <label className="label" htmlFor="email">Email</label>
            <input id="email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {error && <p className="error-text" role="alert">{error}</p>}
          <button className="btn btn-primary btn-big btn-block" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
          <Link href="/login" className="btn-text" style={{ textDecoration: 'none', textAlign: 'center' }}>Back to sign in</Link>
        </form>
      )}
    </div>
  );
}
