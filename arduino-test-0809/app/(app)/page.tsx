'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Btn, Card, ConfirmDialog, Item, Modal, Page, Field, Sheet, type ConfirmSpec } from '../../components/ui';
import { ease, spring } from '../../components/motion';
import ManualControl from '../../components/ManualControl';
import ProtocolSheet from '../../components/ProtocolSheet';
import { mmss, roleOf, useStore } from '../../lib/store';
import { useAuth } from '../../lib/auth/context';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const todayIndex = () => (new Date().getDay() + 6) % 7;

export default function HomePage() {
  const { user } = useAuth();
  const { device, run, log, weeklyUsage, canCommand, pairDevice, renameDevice, stopAll } = useStore();
  const [sheet, setSheet] = useState<'manual' | 'protocol' | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [confirmSpec, setConfirmSpec] = useState<ConfirmSpec | null>(null);
  const [stopConfirm, setStopConfirm] = useState(false);
  const [pairOpen, setPairOpen] = useState(false);
  const [pairName, setPairName] = useState('EasyBlot — Bay 1');
  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState('');

  if (!user) return null;

  const running = !!run?.active;
  const step = running ? run.steps[run.index] : null;
  const total = run ? run.steps.reduce((a, s) => a + s.duration, 0) : 0;
  const done = run
    ? run.steps.slice(0, run.index).reduce((a, s) => a + s.duration, 0)
      + (run.steps[run.index].duration - Math.max(0, run.remaining))
    : 0;
  const pct = total ? Math.min(100, (done / total) * 100) : 0;

  return (
    <Page>
      {/* No account avatar here — the account lives in the nav (rail chip on
          desktop, fourth tab on phones), in exactly one place. */}
      <Item className="page-head">
        <div>
          <div className="caption">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </div>
          <h1>Welcome back, {user.displayName}</h1>
        </div>
      </Item>

      <div className="cols">
        <div>
          {/* ---- Device card (mirrors easyblot/status) ---- */}
          <Item>
            {!device ? (
              <Card>
                <div className="row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <span className="dot offline" /><span className="name">No device paired</span>
                  </div>
                  <span className="pill dashed">Unpaired</span>
                </div>
                <div className="divider" />
                <div className="caption">
                  Pair an EasyBlot unit on your lab network to run protocols from this account.
                  The unit announces itself as <strong style={{ color: 'var(--g4)' }}>easyblot.local</strong> once it joins.
                </div>
                <Btn variant="ghost" block style={{ marginTop: 14 }} onClick={() => setPairOpen(true)}>
                  Pair a device
                </Btn>
              </Card>
            ) : (
              <Card>
                <div className="row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                    <span className={`dot ${device.online ? 'online' : 'offline'}`} />
                    <span className="name">{device.name}</span>
                    <button className="linkbtn" style={{ fontSize: 11 }}
                      onClick={() => { setNewName(device.name); setRenameOpen(true); }}>Edit</button>
                  </div>
                  <span className={`pill${device.online ? ' solid' : ' dashed'}`}>
                    {device.online ? 'Online' : 'Offline'}
                  </span>
                </div>
                <div className="divider" />

                {!device.online ? (
                  <>
                    <div className="row" style={{ marginBottom: 10 }}>
                      <div className="name">Unreachable</div>
                      <span className="pill dashed">No connection</span>
                    </div>
                    <div className="caption">
                      This app cannot reach {device.mdns}. Commands are disabled until the unit reconnects.
                      Any sequence already running continues on the device.
                    </div>
                  </>
                ) : running && step ? (
                  <>
                    <div className="eyebrow" style={{ marginBottom: 8 }}>
                      {run.protocolName ?? 'Ad-hoc sequence'}
                    </div>
                    <div className="row" style={{ marginBottom: 10 }}>
                      <div className="name mono">
                        Step {run.index + 1} of {run.steps.length} — {roleOf(step.pump)}
                      </div>
                      <div className="caption mono">{mmss(Math.max(0, run.remaining))} remaining</div>
                    </div>
                    <div className="progress">
                      <motion.i animate={{ width: `${pct}%` }} transition={{ duration: 0.9, ease: 'linear' }} />
                    </div>
                    <div className="caption" style={{ marginTop: 9 }}>
                      Pump {step.pump} active — sequence running unattended.
                    </div>
                  </>
                ) : (
                  <>
                    <div className="row" style={{ marginBottom: 10 }}>
                      <div className="name">Idle</div>
                      <span className="pill ok">Ready</span>
                    </div>
                    <div className="progress"><i style={{ width: 0 }} /></div>
                    <div className="caption" style={{ marginTop: 9 }}>
                      No sequence queued. Device is holding at rest.
                    </div>
                  </>
                )}
              </Card>
            )}
          </Item>

          {/* ---- Stats ---- */}
          <Item>
            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
              <StatTile label="Blots this week" value={user.blotsWeek} />
              <StatTile label="Total blots" value={user.blotsTotal} />
            </div>
          </Item>

          {/* ---- Quick actions ---- */}
          <Item>
            <AnimatePresence mode="wait">
              {stopConfirm && running ? (
                <motion.div key="confirm" className="confirm-strip"
                  initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={ease}>
                  <div className="msg">Stop the run in progress?</div>
                  <div className="why">
                    Step {run.index + 1} of {run.steps.length} will be aborted and every pump halts
                    immediately. This blot will not be logged.
                  </div>
                  <div className="acts">
                    <Btn size="sm" variant="ghost" onClick={() => setStopConfirm(false)}>Keep running</Btn>
                    <Btn size="sm" variant="danger-solid" onClick={() => { stopAll(); setStopConfirm(false); }}>Stop All</Btn>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="actions" style={{ display: 'flex', gap: 9, marginBottom: 20 }}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Btn size="sm" style={{ flex: 1 }} disabled={!canCommand} onClick={() => setSheet('protocol')}>
                    Run Protocol
                  </Btn>
                  <Btn size="sm" variant="danger" style={{ flex: 1 }} disabled={!running || !canCommand}
                    onClick={() => setStopConfirm(true)}>Stop All</Btn>
                  <Btn size="sm" variant="ghost" style={{ flex: 1 }} disabled={!canCommand}
                    onClick={() => setSheet('manual')}>Manual</Btn>
                </motion.div>
              )}
            </AnimatePresence>
            {!canCommand && (
              <div className="caption" style={{ marginBottom: 20 }}>
                {device
                  ? 'Controls are disabled while the device is offline.'
                  : 'Controls are disabled until a device is paired to this account.'}
              </div>
            )}
          </Item>

          {/* ---- Weekly chart ---- */}
          <Item>
            <Card>
              <div className="row" style={{ marginBottom: 14 }}>
                <div className="eyebrow" style={{ margin: 0 }}>This week</div>
                <div className="caption mono">{weeklyUsage.reduce((a, b) => a + b, 0)} runs</div>
              </div>
              <div className="chart">
                {weeklyUsage.map((v, i) => (
                  <motion.div key={i} className={`bar${v >= 2 ? ' hi' : ''}`}
                    initial={{ height: 3 }}
                    animate={{ height: v ? Math.max(12, v * 24) : 3 }}
                    transition={spring}
                    style={{ outline: i === todayIndex() ? '1px solid var(--ink)' : undefined, outlineOffset: 1 }} />
                ))}
              </div>
              <div className="chart-x">{DAYS.map((d, i) => <span key={i}>{d}</span>)}</div>
            </Card>
          </Item>
        </div>

        {/* ---- Activity log (easyblot/status/log) ---- */}
        <div>
          <Item>
            <div className="row" style={{ alignItems: 'baseline' }}>
              <div className="eyebrow">Activity</div>
              {log.length > 6 && (
                <button className="linkbtn tiny" onClick={() => setLogOpen(true)}>
                  View all {log.length}
                </button>
              )}
            </div>
            {log.length ? (
              <div className="log">
                <AnimatePresence initial={false}>
                  {log.slice(-6).map((l, i) => (
                    <motion.div key={`${l.t}-${i}-${l.msg}`} className="log-line"
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={ease}>
                      <span className="t mono">{l.t}</span>
                      <span className="grow">{l.msg}</span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <Card flat>
                <div className="caption">
                  Nothing yet. Pump commands and sequence progress appear here as the device reports them.
                </div>
              </Card>
            )}
          </Item>
        </div>
      </div>

      <ManualControl open={sheet === 'manual'} onClose={() => setSheet(null)}
        onStopAll={() => setConfirmSpec({
          title: 'Stop all pumps?',
          body: run?.active
            ? 'The sequence in progress will be aborted and this blot will not be logged.'
            : 'Every running pump halts immediately.',
          confirmLabel: 'Stop All', destructive: true, onConfirm: stopAll,
        })} />

      <ProtocolSheet open={sheet === 'protocol'} onClose={() => setSheet(null)} confirm={setConfirmSpec} />

      {/* Full log — the only other view of this data, opened from the strip
          above rather than from a second place in the app. */}
      <Sheet open={logOpen} onClose={() => setLogOpen(false)} title="Activity log"
        subtitle={`${log.length} events from the device`}>
        <div className="log">
          {[...log].reverse().map((l, i) => (
            <div key={`${l.t}-${i}`} className="log-line">
              <span className="t mono">{l.t}</span>
              <span className="grow">{l.msg}</span>
            </div>
          ))}
        </div>
      </Sheet>

      <Modal open={pairOpen} onClose={() => setPairOpen(false)}>
        <h2>Pair a device</h2>
        <p className="sub">
          The shipping build scans your network for units broadcasting over mDNS. Name the unit you are
          adding — this is local to your account.
        </p>
        <Field label="Device name">
          <input className="input" value={pairName} onChange={(e) => setPairName(e.target.value)} maxLength={32} />
        </Field>
        <div className="modal-actions">
          <Btn variant="ghost" onClick={() => setPairOpen(false)}>Cancel</Btn>
          <Btn onClick={() => { pairDevice(pairName); setPairOpen(false); }}>Pair</Btn>
        </div>
      </Modal>

      <Modal open={renameOpen} onClose={() => setRenameOpen(false)}>
        <h2>Rename device</h2>
        <p className="sub">Local to your account. Does not change the unit&apos;s mDNS address.</p>
        <Field label="Device name">
          <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={32} />
        </Field>
        <div className="modal-actions">
          <Btn variant="ghost" onClick={() => setRenameOpen(false)}>Cancel</Btn>
          <Btn disabled={!newName.trim()}
            onClick={() => { renameDevice(newName.trim()); setRenameOpen(false); }}>Save</Btn>
        </div>
      </Modal>

      <ConfirmDialog spec={confirmSpec} onClose={() => setConfirmSpec(null)} />
    </Page>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <Card flat className="grow" style={{ margin: 0, padding: 14 }}>
      <motion.div key={value} className="mono"
        initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={spring}
        style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-.03em' }}>
        {value}
      </motion.div>
      <div className="caption" style={{ marginTop: 2 }}>{label}</div>
    </Card>
  );
}
