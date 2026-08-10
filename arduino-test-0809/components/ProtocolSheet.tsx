'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Btn, Empty, Field, Sheet, type ConfirmSpec } from './ui';
import { rowVariants } from './motion';
import { mmss, roleOf, stepsTotal, useStore } from '../lib/store';
import { PUMP_ROLES, type Protocol, type Step } from '../lib/types';

type View = { kind: 'library' } | { kind: 'builder'; id: string | null };

/**
 * Protocol library + step builder.
 * Running one publishes cmd/sequence {steps:[{pump,duration}]} — the device
 * never receives the protocol name, which is app-side bookkeeping only.
 */
export default function ProtocolSheet({ open, onClose, confirm }: {
  open: boolean; onClose(): void; confirm(spec: ConfirmSpec): void;
}) {
  const { protocols, canCommand, run, saveProtocol, deleteProtocol, duplicateProtocol, startSequence } = useStore();
  const [view, setView] = useState<View>({ kind: 'library' });
  const [name, setName] = useState('');
  const [steps, setSteps] = useState<Step[]>([]);
  const [draftPump, setDraftPump] = useState(1);
  const [draftDur, setDraftDur] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const reset = () => {
    setView({ kind: 'library' }); setName(''); setSteps([]);
    setDraftDur(''); setDraftPump(1); setError(null);
  };

  const closeAll = () => { reset(); setNotice(''); onClose(); };

  const openBuilder = (p: Protocol | null) => {
    setView({ kind: 'builder', id: p?.id ?? null });
    setName(p?.name ?? '');
    setSteps(p ? p.steps.map((s) => ({ ...s })) : []);
    setError(null);
    setNotice('');
  };

  const launch = (s: Step[], p: Protocol | null) => {
    const go = () => { startSequence(s, p); closeAll(); };
    if (run?.active) {
      confirm({
        title: 'Replace the running sequence?',
        body: `${run.protocolName ? `“${run.protocolName}” is` : 'A sequence is'} still running. Starting a new one aborts it and the in-flight blot will not be logged.`,
        confirmLabel: 'Replace run', destructive: true, onConfirm: go,
      });
    } else go();
  };

  const onSave = () => {
    const trimmed = name.trim();
    if (!trimmed) { setError('Give the protocol a name.'); return; }
    if (!steps.length) { setError('Add at least one step before saving.'); return; }
    const clash = protocols.some(
      (p) => p.id !== (view.kind === 'builder' ? view.id : null) && p.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (clash) { setError('You already have a protocol with that name.'); return; }
    saveProtocol({ name: trimmed, note: '', steps }, view.kind === 'builder' ? view.id : null);
    setNotice(`Saved “${trimmed}”.`);
    reset();
  };

  const addStep = () => {
    const d = parseInt(draftDur, 10);
    if (Number.isNaN(d) || d <= 0) { setError('Enter a duration in seconds before adding a step.'); return; }
    setSteps((s) => [...s, { pump: draftPump, duration: d }]);
    setDraftDur('');
    setError(null);
  };

  const move = (i: number, dir: -1 | 1) => setSteps((s) => {
    const j = i + dir;
    if (j < 0 || j >= s.length) return s;
    const next = [...s];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });

  const isBuilder = view.kind === 'builder';

  return (
    <Sheet
      open={open}
      onClose={closeAll}
      title={isBuilder ? (view.id ? 'Edit protocol' : 'New protocol') : 'Protocols'}
      subtitle={isBuilder
        ? `${steps.length} step${steps.length === 1 ? '' : 's'}${stepsTotal(steps) ? ` — ${mmss(stepsTotal(steps))} total` : ''}`
        : protocols.length ? `${protocols.length} saved` : 'Save a wash sequence to reuse it'}
      lead={isBuilder ? <button className="iconbtn" onClick={reset} aria-label="Back">‹</button> : undefined}
    >
      <AnimatePresence mode="wait">
        {!isBuilder ? (
          <motion.div key="library" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {notice && <div className="ok-note" style={{ marginBottom: 14 }}>{notice}</div>}

            {!protocols.length ? (
              <Empty title="No protocols yet"
                action={<Btn size="sm" onClick={() => openBuilder(null)}>Create a protocol</Btn>}>
                Save the wash sequences you run often — per target, per antibody,
                per bench routine — and start them in one tap.
              </Empty>
            ) : (
              <div className="boxed">
                <AnimatePresence initial={false}>
                  {protocols.map((p) => (
                    <motion.div key={p.id} className="lrow" style={{ alignItems: 'flex-start' }}
                      variants={rowVariants} initial="hidden" animate="show" exit="exit" layout>
                      <div className="grow" style={{ cursor: 'pointer' }} onClick={() => openBuilder(p)}>
                        <div className="name">{p.name}</div>
                        <div className="meta">
                          {p.steps.length} steps · {mmss(stepsTotal(p.steps))} · run {p.runCount}×
                          {p.lastRun ? ` · ${p.lastRun}` : ''}
                        </div>
                      </div>
                      <Btn size="sm" variant="ghost" disabled={!canCommand} onClick={() => launch(p.steps, p)}>Run</Btn>
                      <button className="iconbtn" aria-label="Duplicate" onClick={() => duplicateProtocol(p.id)}>⧉</button>
                      <button className="iconbtn danger" aria-label="Delete" onClick={() => confirm({
                        title: `Delete “${p.name}”?`,
                        body: 'The saved protocol is removed from your library. Runs already logged are unaffected.',
                        confirmLabel: 'Delete', destructive: true,
                        onConfirm: () => deleteProtocol(p.id),
                      })}>✕</button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {!!protocols.length && (
              <Btn variant="ghost" block onClick={() => openBuilder(null)}>New protocol</Btn>
            )}
            <div className="caption" style={{ marginTop: 12 }}>
              {canCommand
                ? 'Protocol names stay in your account — the device receives only the step list.'
                : 'Device is offline — protocols can be edited but not run.'}
            </div>
          </motion.div>
        ) : (
          <motion.div key="builder" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Field label="Protocol name" error={error && !steps.length ? null : error}>
              <input className="input" value={name} maxLength={48}
                placeholder="e.g. Phospho-ERK — low abundance"
                onChange={(e) => { setName(e.target.value); setError(null); }} />
            </Field>

            <div className="eyebrow">Sequence</div>
            <div className="boxed">
              {!steps.length ? (
                <div className="empty" style={{ padding: '22px 8px' }}>
                  No steps yet. Add a pump and a duration below.
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {steps.map((s, i) => (
                    <motion.div key={`${i}-${s.pump}-${s.duration}`} className="step"
                      variants={rowVariants} initial="hidden" animate="show" exit="exit" layout>
                      <div className="step-n">{i + 1}</div>
                      <div className="grow">
                        <div className="name">Pump {s.pump} — {roleOf(s.pump)}</div>
                        <div className="meta mono">{s.duration}s</div>
                      </div>
                      <button className="iconbtn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">↑</button>
                      <button className="iconbtn" disabled={i === steps.length - 1} onClick={() => move(i, 1)} aria-label="Move down">↓</button>
                      <button className="iconbtn danger" aria-label="Remove"
                        onClick={() => setSteps((prev) => prev.filter((_, x) => x !== i))}>✕</button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>

            <div className="eyebrow" style={{ marginTop: 16 }}>Add step</div>
            <div style={{ display: 'flex', gap: 9, alignItems: 'center', marginBottom: 8 }}>
              <select className="input" style={{ flex: 1 }} value={draftPump}
                onChange={(e) => setDraftPump(parseInt(e.target.value, 10))}>
                {PUMP_ROLES.map((role, i) => <option key={role} value={i + 1}>{i + 1} — {role}</option>)}
              </select>
              <input className="input" style={{ width: 88, textAlign: 'center' }} inputMode="numeric"
                placeholder="sec" value={draftDur}
                onChange={(e) => { setDraftDur(e.target.value.replace(/[^0-9]/g, '').slice(0, 4)); setError(null); }} />
              <Btn size="sm" onClick={addStep}>Add</Btn>
            </div>
            {error && <div className="err" style={{ marginBottom: 12 }}>{error}</div>}

            <div style={{ display: 'flex', gap: 9, marginTop: 8 }}>
              <Btn variant="ghost" style={{ flex: 1 }} disabled={!steps.length} onClick={onSave}>Save protocol</Btn>
              <Btn style={{ flex: 1 }} disabled={!steps.length || !canCommand}
                onClick={() => launch(steps, null)}>Start Sequence</Btn>
            </div>
            <div className="caption" style={{ marginTop: 12 }}>
              {canCommand
                ? 'Starting a sequence replaces any run in progress. The device continues unattended if this page closes.'
                : 'Device is offline — sequences cannot be started until it reconnects.'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Sheet>
  );
}
