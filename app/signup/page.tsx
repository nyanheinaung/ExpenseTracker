'use client';

import Link from 'next/link';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function SignUpPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [creator, setCreator] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError('Enter your name.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email address.');
    if (password.length < 8) return setError('Use a password of at least 8 characters.');
    if (creator.trim() && !/^\S+@\S+\.\S+$/.test(creator.trim())) return setError('The sheet creator’s email doesn’t look right.');
    if (creator.trim().toLowerCase() === email.trim().toLowerCase()) return setError('The sheet creator’s email must be someone else’s.');
    setBusy(true);
    const { data, error } = await supabase().auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { display_name: name.trim(), creator_email: creator.trim() },
        emailRedirectTo: `${window.location.origin}/login`
      }
    });
    setBusy(false);
    if (error) {
      setError(/already registered/i.test(error.message) ? 'An account with this email already exists. Sign in instead.' : error.message);
      return;
    }
    if (!data.session) setSent(true);
  }

  if (sent) {
    return (
      <div className="auth stack-lg">
        <h1 className="big-title">Check your email</h1>
        <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>
          We sent a confirmation link to {email.trim()}. Open it on this device, then sign in.
        </p>
        <Link href="/login" className="btn btn-primary btn-big btn-block">Go to sign in</Link>
      </div>
    );
  }

  return (
    <div className="auth">
      <form className="stack-lg" onSubmit={submit} noValidate>
        <div>
          <h1 className="big-title">Create your account</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>One account per email address.</p>
        </div>
        <div className="field">
          <label className="label" htmlFor="name">Your name</label>
          <input id="name" className="input" autoComplete="name" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label className="label" htmlFor="email">Email</label>
          <input id="email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label className="label" htmlFor="password">Password</label>
          <input id="password" className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <p className="help">At least 8 characters.</p>
        </div>
        <div className="card field" style={{ padding: 16 }}>
          <label className="label" htmlFor="creator">
            Join an existing sheet? <span className="opt">(optional)</span>
          </label>
          <input id="creator" className="input" type="email" placeholder="Sheet creator’s email" value={creator} onChange={(e) => setCreator(e.target.value)} />
          <p className="help">Leave blank to start your own sheet. If you fill it in, the creator will be asked to approve you.</p>
        </div>
        {error && <p className="error-text" role="alert">{error}</p>}
        <button className="btn btn-primary btn-big btn-block" disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </button>
        <Link href="/login" className="btn-text" style={{ textDecoration: 'none', textAlign: 'center' }}>
          Already have an account? Sign in
        </Link>
      </form>
    </div>
  );
}
