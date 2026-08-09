'use client';

import { Sheet, Btn } from './ui';
import { mmss, useStore } from '../lib/store';

/** Manual pump control — maps 1:1 to cmd/pump {pump, action, duration}. */
export default function ManualControl({ open, onClose, onStopAll }: {
  open: boolean; onClose(): void; onStopAll(): void;
}) {
  const { pumps, run, canCommand, setPumpDuration, togglePump } = useStore();
  const seqPumpId = run?.active ? run.steps[run.index].pump : null;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Manual Control"
      subtitle="Direct pump control. Blank duration runs until stopped."
    >
      {pumps.map((p) => {
        const locked = p.id === seqPumpId;
        const status = !p.on
          ? 'Idle'
          : p.remaining === null ? 'Running — indefinite' : `${mmss(Math.max(0, p.remaining))} left`;
        return (
          <div key={p.id} className={`pump${p.on ? ' on' : ''}${locked ? ' locked' : ''}`}>
            <div className="pnum">{p.id}</div>
            <div className="grow">
              <div className="name">{p.role}</div>
              <div className="meta">{locked ? `Sequence step — ${status}` : status}</div>
            </div>
            <input
              className="dur"
              inputMode="numeric"
              placeholder="sec"
              value={p.durationInput}
              disabled={p.on || locked || !canCommand}
              onChange={(e) => setPumpDuration(p.id, e.target.value)}
            />
            <button
              type="button"
              className={`toggle${p.on ? ' on' : ''}`}
              aria-pressed={p.on}
              aria-label={`Pump ${p.id}`}
              disabled={locked || !canCommand}
              onClick={() => togglePump(p.id)}
              style={{ opacity: locked || !canCommand ? 0.35 : 1 }}
            >
              <span className="knob" style={{ left: p.on ? 21 : 3, transition: 'left .16s' }} />
            </button>
          </div>
        );
      })}

      <div className="caption" style={{ marginTop: 16 }}>
        Manual commands publish to <strong style={{ color: 'var(--g4)' }}>cmd/pump</strong>. Pumps driven by a
        running sequence are locked here so a manual toggle cannot desync the queue.
      </div>

      <Btn variant="danger" block style={{ marginTop: 14 }} onClick={onStopAll}>Stop All Pumps</Btn>
    </Sheet>
  );
}
