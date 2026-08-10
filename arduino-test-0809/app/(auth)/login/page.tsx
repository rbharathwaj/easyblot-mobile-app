'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Btn, Field, Item } from '../../../components/ui';
import Brand from '../../../components/Brand';
import { useAuth } from '../../../lib/auth/context';
import { AuthError } from '../../../lib/auth/adapter';

export default function LoginPage() {
  const { logIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) { setError('Enter your email and password.'); return; }
    setBusy(true);
    try {
      const user = await logIn(email, password);
      router.push(user.verified ? '/' : '/verify');
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'Could not sign you in.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <Item><Brand /></Item>
      <Item>
        <h1>Log in</h1>
        <p className="sub">Use the address your account was created with.</p>
      </Item>

      <div style={{ height: 24 }} />

      <Item>
        <Field label="Email">
          <input className={`input${error ? ' error' : ''}`} type="email" value={email}
            placeholder="you@university.edu" onChange={(e) => { setEmail(e.target.value); setError(null); }} />
        </Field>
      </Item>

      <Item>
        <Field label="Password" error={error}>
          <input className={`input${error ? ' error' : ''}`} type="password" value={password}
            placeholder="••••••••" onChange={(e) => { setPassword(e.target.value); setError(null); }} />
        </Field>
      </Item>

      <Item><Btn type="submit" block disabled={busy}>{busy ? 'Checking…' : 'Log in'}</Btn></Item>

      <Item>
        <div className="auth-foot">
          <span className="caption">
            No account yet? <Link href="/signup" className="linkbtn">Sign up</Link>
          </span>
          <span className="caption">
            Password reset needs a mail server — see the README for the backend step.
          </span>
        </div>
      </Item>
    </form>
  );
}
