'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Btn, Field, Item } from '../../../components/ui';
import { spring } from '../../../components/motion';
import { useAuth } from '../../../lib/auth/context';
import { AuthError } from '../../../lib/auth/adapter';
import { TIER_LABEL } from '../../../lib/auth/email';

export default function VerifyPage() {
  const { user, status, submitCode, resendCode, logOut } = useAuth();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Local mode has no mail server, so the code is surfaced here instead.
  const [devCode, setDevCode] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'anonymous') router.replace('/login');
  }, [status, router]);

  useEffect(() => {
    if (user && !user.verified && user.pendingCode) setDevCode(user.pendingCode);
  }, [user]);

  if (!user) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await submitCode(code);
      router.push('/');
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'Could not verify that code.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <Item><div className="auth-brand">EASYBLOT</div></Item>
      <Item>
        <h1>Confirm your email</h1>
        <p className="sub">
          We need to know the address is yours. Enter the 6-digit code issued for{' '}
          <strong style={{ color: 'var(--ink)' }}>{user.email}</strong>.
        </p>
      </Item>

      <Item>
        <div className="card flat" style={{ marginTop: 18 }}>
          <div className="row">
            <span className="caption">Account type</span>
            <span className={`pill${user.tier === 'institution' ? ' solid' : ''}`}>{TIER_LABEL[user.tier]}</span>
          </div>
        </div>
      </Item>

      {devCode && (
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={spring}
          style={{ borderStyle: 'dashed' }}
        >
          <div className="eyebrow" style={{ margin: 0 }}>Local mode — no mail server</div>
          <div className="mono" style={{ fontSize: 26, fontWeight: 700, letterSpacing: '.2em', margin: '10px 0 4px' }}>
            {devCode}
          </div>
          <div className="caption">
            With a backend this is emailed instead of shown. It expires in 15 minutes.
          </div>
        </motion.div>
      )}

      <Item>
        <Field label="Verification code" error={error}>
          <input
            className={`input code-input${error ? ' error' : ''}`}
            inputMode="numeric"
            maxLength={6}
            value={code}
            placeholder="000000"
            onChange={(e) => { setCode(e.target.value.replace(/[^0-9]/g, '')); setError(null); }}
          />
        </Field>
      </Item>

      <Item>
        <Btn type="submit" block disabled={busy || code.length !== 6}>
          {busy ? 'Verifying…' : 'Verify and continue'}
        </Btn>
      </Item>

      <Item>
        <div className="auth-foot">
          <button type="button" className="linkbtn" onClick={async () => setDevCode(await resendCode())}>
            Issue a new code
          </button>
          <button type="button" className="linkbtn" onClick={async () => { await logOut(); router.push('/login'); }}>
            Use a different account
          </button>
        </div>
      </Item>
    </form>
  );
}
