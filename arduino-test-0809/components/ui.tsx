'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { itemVariants, modalVariants, pageVariants, scrimVariants, sheetVariants, spring, tapScale } from './motion';
import type { PublicUser } from '../lib/types';

/* ---------- Layout primitives ---------- */

export function Page({ children }: { children: React.ReactNode }) {
  return (
    <motion.div variants={pageVariants} initial="hidden" animate="show" exit="exit">
      {children}
    </motion.div>
  );
}

export function Item({ children, className, style }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties;
}) {
  return <motion.div variants={itemVariants} className={className} style={style}>{children}</motion.div>;
}

export function Card({ children, flat, className = '', style }: {
  children: React.ReactNode; flat?: boolean; className?: string; style?: React.CSSProperties;
}) {
  return <div className={`card${flat ? ' flat' : ''} ${className}`} style={style}>{children}</div>;
}

export function Empty({ title, children, action }: {
  title: string; children?: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <motion.div className="empty" variants={itemVariants}>
      <h3>{title}</h3>
      <div>{children}</div>
      {action}
    </motion.div>
  );
}

/* ---------- Buttons ---------- */

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'solid' | 'ghost' | 'danger' | 'danger-solid';
  size?: 'md' | 'sm';
  block?: boolean;
};

export function Btn({ variant = 'solid', size = 'md', block, className = '', ...rest }: BtnProps) {
  const classes = [
    'btn',
    variant === 'ghost' ? 'ghost' : '',
    variant === 'danger' ? 'danger' : '',
    variant === 'danger-solid' ? 'danger-solid' : '',
    size === 'sm' ? 'sm' : '',
    block ? 'block' : '',
    className,
  ].filter(Boolean).join(' ');
  return (
    <motion.button
      {...(rest as React.ComponentProps<typeof motion.button>)}
      className={classes}
      whileTap={rest.disabled ? undefined : tapScale}
      whileHover={rest.disabled ? undefined : { opacity: 0.88 }}
      transition={spring}
    />
  );
}

/* ---------- Fields ---------- */

export function Field({ label, error, hint, note, children }: {
  label?: string; error?: string | null; hint?: string; note?: string | null; children: React.ReactNode;
}) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      {children}
      <AnimatePresence mode="wait">
        {error ? (
          <motion.div key="err" className="err" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {error}
          </motion.div>
        ) : note ? (
          <motion.div key="note" className="ok-note" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {note}
          </motion.div>
        ) : hint ? (
          <motion.div key="hint" className="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {hint}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/* ---------- Toggle ---------- */

export function Toggle({ on, onChange, label }: { on: boolean; onChange(v: boolean): void; label?: string }) {
  return (
    <button
      type="button"
      className={`toggle${on ? ' on' : ''}`}
      aria-pressed={on}
      aria-label={label}
      onClick={() => onChange(!on)}
    >
      <motion.span className="knob" layout transition={spring} style={{ left: on ? 21 : 3 }} />
    </button>
  );
}

/* ---------- Avatar ---------- */

export function Avatar({ user, size = 'md', outline }: {
  user: Pick<PublicUser, 'initials' | 'activeNow'> & { avatar?: string | null };
  size?: 'sm' | 'md' | 'lg';
  outline?: boolean;
}) {
  const cls = `avatar ${size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : ''}${outline && !user.avatar ? ' outline' : ''}`;
  return (
    <span className={`av-wrap${size === 'lg' ? ' lg' : ''}`}>
      {user.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URL, no loader needed
        <img className={`${cls} avatar-img`} src={user.avatar} alt="" />
      ) : (
        <span className={cls}>{user.initials}</span>
      )}
      {user.activeNow && (
        <motion.span
          className="av-dot"
          title="Running a wash now"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={spring}
        />
      )}
    </span>
  );
}

/* ---------- Sheet ---------- */

export function Sheet({ open, title, subtitle, onClose, children, lead }: {
  open: boolean; title: string; subtitle?: string; onClose(): void;
  children: React.ReactNode; lead?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="scrim" variants={scrimVariants} initial="hidden" animate="show" exit="exit"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div className="sheet" variants={sheetVariants} initial="hidden" animate="show" exit="exit">
            <div className="grab" />
            <div className="sheet-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                {lead}
                <div style={{ minWidth: 0 }}>
                  <h2>{title}</h2>
                  {subtitle && <div className="caption" style={{ marginTop: 3 }}>{subtitle}</div>}
                </div>
              </div>
              <button className="iconbtn" onClick={onClose} aria-label="Close">✕</button>
            </div>
            <div className="sheet-body">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------- Modal + confirm ---------- */

export interface ConfirmSpec {
  title: string;
  body?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm(): void | Promise<void>;
}

export function Modal({ open, onClose, children }: {
  open: boolean; onClose(): void; children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-scrim" variants={scrimVariants} initial="hidden" animate="show" exit="exit"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div className="modal" variants={modalVariants} initial="hidden" animate="show" exit="exit">
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Styled replacement for window.confirm — never use the native dialog. */
export function ConfirmDialog({ spec, onClose }: { spec: ConfirmSpec | null; onClose(): void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={!!spec} onClose={onClose}>
      {spec && (
        <>
          <h2>{spec.title}</h2>
          {spec.body && <div className="sub">{spec.body}</div>}
          <div className="modal-actions">
            <Btn variant="ghost" onClick={onClose}>{spec.cancelLabel ?? 'Cancel'}</Btn>
            <Btn
              variant={spec.destructive ? 'danger-solid' : 'solid'}
              disabled={busy}
              onClick={async () => { setBusy(true); await spec.onConfirm(); setBusy(false); onClose(); }}
            >
              {spec.confirmLabel ?? 'Confirm'}
            </Btn>
          </div>
        </>
      )}
    </Modal>
  );
}

/* ---------- Segmented control with a sliding indicator ---------- */

export function Segmented<T extends string>({ value, options, onChange, layoutId }: {
  value: T; options: { value: T; label: string }[]; onChange(v: T): void; layoutId: string;
}) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.value} className={o.value === value ? 'active' : ''} onClick={() => onChange(o.value)}>
          {o.value === value && (
            <motion.span className="seg-pill" layoutId={layoutId} transition={spring}
              style={{ left: 0, right: 0, top: 0, bottom: 0, position: 'absolute', zIndex: -1 }} />
          )}
          {o.label}
        </button>
      ))}
    </div>
  );
}
