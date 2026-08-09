'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Btn, Field, Item } from '../../../components/ui';
import { ease } from '../../../components/motion';
import { useAuth } from '../../../lib/auth/context';
import { AuthError } from '../../../lib/auth/adapter';
import { classifyEmail, domainOf, TIER_LABEL } from '../../../lib/auth/email';
import UniversityInput from '../../../components/UniversityInput';
import { loadUniversities, universityForDomain } from '../../../lib/universities';
import { checkPasswordStrength } from '../../../lib/auth/crypto';
import { initialsFrom } from '../../../lib/types';

export default function SignUpPage() {
  const { signUp } = useAuth();
  const router = useRouter();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [institution, setInstitution] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // Live tier feedback — the user learns which account they are getting
  // while typing, rather than being told after they submit.
  const verdict = useMemo(() => classifyEmail(email), [email]);
  const strength = useMemo(() => checkPasswordStrength(password), [password]);

  // Auto-fill the institution from the email domain when we recognise it.
  // Only fills a field the user has not typed into, so it can never overwrite
  // a deliberate choice — and it stays editable either way.
  const [autoFilled, setAutoFilled] = useState<string | null>(null);
  const touchedInstitution = useRef(false);

  useEffect(() => {
    if (!verdict.requiresInstitution) { setAutoFilled(null); return; }
    if (touchedInstitution.current) return;
    let cancelled = false;
    void loadUniversities().then((list) => {
      if (cancelled) return;
      const hit = universityForDomain(list, domainOf(email));
      if (hit) { setInstitution(hit.n); setAutoFilled(hit.n); }
    });
    return () => { cancelled = true; };
  }, [email, verdict.requiresInstitution]);

  const setError = (k: string, v?: string) =>
    setErrors((e) => { const next = { ...e }; if (v) next[k] = v; else delete next[k]; return next; });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!firstName.trim()) next.firstName = 'Required.';
    if (!lastName.trim()) next.lastName = 'Required.';
    if (!verdict.ok) next.email = verdict.message || 'Enter a valid email address.';
    if (verdict.requiresInstitution && !institution.trim()) {
      next.institution = 'Tell us which institution this address belongs to.';
    }
    if (!strength.ok) next.password = strength.message;
    // Confirmation never reaches storage, so it is validated here rather than
    // in the adapter — the adapter only ever sees one password.
    else if (password !== confirmPassword) next.confirmPassword = 'The two passwords do not match.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      await signUp({ firstName, lastName, email, password, displayName, institution });
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
        <div className="field-row">
          <Field label="First name" error={errors.firstName}>
            <input
              className={`input${errors.firstName ? ' error' : ''}`}
              value={firstName}
              autoComplete="given-name"
              placeholder="Your first name"
              onChange={(e) => { setFirstName(e.target.value); setError('firstName'); }}
            />
          </Field>
          <Field label="Last name" error={errors.lastName}>
            <input
              className={`input${errors.lastName ? ' error' : ''}`}
              value={lastName}
              autoComplete="family-name"
              placeholder="Your last name"
              onChange={(e) => { setLastName(e.target.value); setError('lastName'); }}
            />
          </Field>
        </div>
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
            <Field
              label="Institution"
              error={errors.institution}
              note={autoFilled && institution === autoFilled ? `Matched from your email domain — edit if that is wrong.` : null}
              hint="Search 2,300+ US institutions, or type your own. Private by default — never shown on the leaderboard or forum."
            >
              <UniversityInput
                value={institution}
                error={errors.institution}
                onChange={(v) => {
                  touchedInstitution.current = true;
                  setAutoFilled(null);
                  setInstitution(v);
                  setError('institution');
                }}
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
            autoComplete="new-password"
            placeholder="••••••••"
            onChange={(e) => {
              setPassword(e.target.value);
              setError('password');
              // Clear a stale mismatch as soon as the two agree again.
              if (confirmPassword && e.target.value === confirmPassword) setError('confirmPassword');
            }}
          />
        </Field>
      </Item>

      <Item>
        <Field
          label="Confirm password"
          error={errors.confirmPassword}
          note={!errors.confirmPassword && confirmPassword && password === confirmPassword ? 'Passwords match.' : null}
        >
          <input
            className={`input${errors.confirmPassword ? ' error' : ''}`}
            type="password"
            value={confirmPassword}
            autoComplete="new-password"
            placeholder="••••••••"
            onChange={(e) => { setConfirmPassword(e.target.value); setError('confirmPassword'); }}
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
