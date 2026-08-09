'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Btn, Field, Item } from '../../../components/ui';
import { ease } from '../../../components/motion';
import { useAuth } from '../../../lib/auth/context';
import { AuthError } from '../../../lib/auth/adapter';
import { classifyEmail, TIER_LABEL } from '../../../lib/auth/email';
import { checkPasswordStrength } from '../../../lib/auth/crypto';
import { initialsFrom } from '../../../lib/types';

export default function SignUpPage() {
  const { signUp } = useAuth();
  const router = useRouter();

  const [realName, setRealName] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [institution, setInstitution] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // Live tier feedback — the user learns which account they are getting
  // while typing, rather than being told after they submit.
  const verdict = useMemo(() => classifyEmail(email), [email]);
  const strength = useMemo(() => checkPasswordStrength(password), [password]);

  const setError = (k: string, v?: string) =>
    setErrors((e) => { const next = { ...e }; if (v) next[k] = v; else delete next[k]; return next; });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!realName.trim()) next.realName = 'Enter your full name.';
    if (!verdict.ok) next.email = verdict.message || 'Enter a valid email address.';
    if (verdict.requiresInstitution && !institution.trim()) {
      next.institution = 'Tell us which institution this address belongs to.';
    }
    if (!strength.ok) next.password = strength.message;
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      await signUp({ realName, email, password, displayName, institution });
      router.push('/verify');
    } catch (err) {
      if (err instanceof AuthError) setError(err.field ?? 'email', err.message);
      else setError('email', 'Something went wrong creating the account.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <Item><div className="auth-brand">EASYBLOT</div></Item>
      <Item>
        <h1>Create your account</h1>
        <p className="sub">
          A university address verifies you as a research lab. Working independently?
          A personal address works too — you just join as an Independent user.
        </p>
      </Item>

      <div style={{ height: 24 }} />

      <Item>
        <Field label="Full name" error={errors.realName}>
          <input
            className={`input${errors.realName ? ' error' : ''}`}
            value={realName}
            placeholder="Your name"
            onChange={(e) => { setRealName(e.target.value); setError('realName'); }}
          />
        </Field>
      </Item>

      <Item>
        <Field
          label="Email"
          error={errors.email}
          note={!errors.email && verdict.ok && email ? verdict.message : null}
          hint={!email ? 'University address for a verified lab account, or any personal address.' : undefined}
        >
          <input
            className={`input${errors.email ? ' error' : ''}`}
            type="email"
            value={email}
            placeholder="you@university.edu"
            onChange={(e) => { setEmail(e.target.value); setError('email'); }}
          />
        </Field>
      </Item>

      <AnimatePresence>
        {verdict.ok && email && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} transition={ease} style={{ overflow: 'hidden' }}
          >
            <div className="card flat" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className={`pill${verdict.tier === 'institution' ? ' solid' : ''}`}>
                {TIER_LABEL[verdict.tier]}
              </span>
              <span className="caption">
                {verdict.tier === 'institution'
                  ? 'Full access, institution recorded privately.'
                  : 'Full access. No institution attached to your profile.'}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {verdict.requiresInstitution && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} transition={ease} style={{ overflow: 'hidden' }}
          >
            <Field label="Institution" error={errors.institution}
              hint="Private by default — never shown on the leaderboard or forum.">
              <input
                className={`input${errors.institution ? ' error' : ''}`}
                value={institution}
                placeholder="e.g. Stanford University"
                onChange={(e) => { setInstitution(e.target.value); setError('institution'); }}
              />
            </Field>
          </motion.div>
        )}
      </AnimatePresence>

      <Item>
        <Field label="Display name" error={errors.displayName}
          hint={`Public. ${displayName.trim() ? `Shown as ${initialsFrom(displayName)}.` : 'Defaults to your first name.'}`}>
          <input
            className={`input${errors.displayName ? ' error' : ''}`}
            value={displayName}
            placeholder="Optional"
            onChange={(e) => { setDisplayName(e.target.value); setError('displayName'); }}
          />
        </Field>
      </Item>

      <Item>
        <Field label="Password" error={errors.password}
          hint="At least 8 characters, with a letter and a number.">
          <input
            className={`input${errors.password ? ' error' : ''}`}
            type="password"
            value={password}
            placeholder="••••••••"
            onChange={(e) => { setPassword(e.target.value); setError('password'); }}
          />
        </Field>
      </Item>

      <Item>
        <Btn type="submit" block disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</Btn>
      </Item>

      <Item>
        <div className="auth-foot">
          <span className="caption">
            Already have an account? <Link href="/login" className="linkbtn">Log in</Link>
          </span>
        </div>
      </Item>
    </form>
  );
}
