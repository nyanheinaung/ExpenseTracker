'use client';

import Link from 'next/link';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      if (/confirm/i.test(error.message)) setError('Please confirm your email first. Check your inbox for the link.');
      else if (/invalid/i.test(error.message)) setError('Email or password is incorrect.');
      else setError(error.message);
    }
  }

  return (
    <div className="auth">
      <form className="stack-lg" onSubmit={submit} noValidate>
        <div>
          <h1 className="big-title">Sign in</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>Monthly expenses, shared with your team.</p>
        </div>
        <div className="field">
          <label className="label" htmlFor="email">Email</label>
          <input id="email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label className="label" htmlFor="password">Password</label>
          <input id="password" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p className="error-text" role="alert">{error}</p>}
        <button className="btn btn-primary btn-big btn-block" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <div className="stack" style={{ gap: 4, alignItems: 'center' }}>
          <Link href="/signup" className="btn-text" style={{ textDecoration: 'none' }}>Create an account</Link>
          <Link href="/forgot" className="btn-text" style={{ textDecoration: 'none', fontWeight: 500 }}>Forgot password?</Link>
        </div>
      </form>
    </div>
  );
}
