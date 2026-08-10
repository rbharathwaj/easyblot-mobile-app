'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as db from './db';
import { useAuth } from './auth/context';
import { randomId } from './auth/crypto';
import {
  PUMP_ROLES, emptyUserData,
  type DeviceState, type LogLine, type Protocol, type Pump, type RunState,
  type Step, type Thread, type UserData,
} from './types';

/* ------------------------------------------------------------------
   MQTT contract this store is written against (unchanged from the
   prototype — a real client swaps the bodies of the cmd* functions):
     PUBLISH  easyblot/cmd/pump      {pump, action, duration}
     PUBLISH  easyblot/cmd/sequence  {steps:[{pump,duration}]}
     PUBLISH  easyblot/cmd/stop      {}
     SUBSCRIBE easyblot/status, easyblot/status/log
   ------------------------------------------------------------------ */

const clock = () => new Date().toTimeString().slice(0, 8);
const todayIndex = () => (new Date().getDay() + 6) % 7;
export const roleOf = (n: number) => PUMP_ROLES[n - 1];
export const stepsTotal = (s: Step[]) => s.reduce((a, x) => a + x.duration, 0);
export const mmss = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function freshPumps(): Pump[] {
  return PUMP_ROLES.map((role, i) => ({ id: i + 1, role, on: false, remaining: null, durationInput: '' }));
}

interface StoreValue {
  ready: boolean;
  device: DeviceState | null;
  run: RunState | null;
  pumps: Pump[];
  protocols: Protocol[];
  log: LogLine[];
  weeklyUsage: number[];
  threads: Thread[];
  canCommand: boolean;

  pairDevice(name: string): void;
  renameDevice(name: string): void;
  forgetDevice(): void;
  setOnline(online: boolean): void;

  setPumpDuration(id: number, value: string): void;
  togglePump(id: number): void;
  startSequence(steps: Step[], protocol?: Protocol | null): void;
  stopAll(): void;

  saveProtocol(p: Omit<Protocol, 'id' | 'runCount' | 'lastRun'>, id?: string | null): Protocol;
  deleteProtocol(id: string): void;
  duplicateProtocol(id: string): void;

  addThread(t: { title: string; body: string; category: string }): Thread;
  updateThread(id: string, patch: { title?: string; body?: string; category?: string }): void;
  deleteThread(id: string): void;
  addReply(threadId: string, body: string): void;
  updateReply(threadId: string, replyId: string, body: string): void;
  deleteReply(threadId: string, replyId: string): void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { user, updateUser } = useAuth();
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<UserData>(emptyUserData());
  const [pumps, setPumps] = useState<Pump[]>(freshPumps);
  const [threads, setThreads] = useState<Thread[]>([]);

  const userId = user?.id ?? null;

  // --- load / persist -------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [d, f] = await Promise.all([
        userId ? db.get<UserData>(db.KEYS.userData(userId), emptyUserData()) : Promise.resolve(emptyUserData()),
        db.get<Thread[]>(db.KEYS.forum, []),
      ]);
      if (cancelled) return;
      setData(d);
      setThreads(f);
      setPumps(freshPumps());
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    if (ready && userId) void db.set(db.KEYS.userData(userId), data);
  }, [ready, userId, data]);

  useEffect(() => {
    if (ready) void db.set(db.KEYS.forum, threads);
  }, [ready, threads]);

  const canCommand = !!data.device?.paired && !!data.device?.online;

  const pushLog = useCallback((msg: string) => {
    setData((d) => ({ ...d, log: [...d.log, { t: clock(), msg }].slice(-40) }));
  }, []);

  // --- device ---------------------------------------------------------
  const pairDevice = useCallback((name: string) => {
    const device: DeviceState = {
      name: name.trim() || 'EasyBlot unit',
      paired: true, online: true,
      wifi: 'Local network', mdns: 'easyblot.local',
    };
    setData((d) => ({ ...d, device, log: [...d.log, { t: clock(), msg: `Paired ${device.name} at ${device.mdns}.` }] }));
  }, []);

  const renameDevice = useCallback((name: string) => {
    setData((d) => (d.device ? { ...d, device: { ...d.device, name } } : d));
  }, []);

  const forgetDevice = useCallback(() => {
    setPumps(freshPumps());
    setData((d) => ({
      ...d, device: null, run: null,
      log: [...d.log, { t: clock(), msg: 'Device unpaired from this account.' }],
    }));
  }, []);

  const setOnline = useCallback((online: boolean) => {
    setData((d) => (d.device ? {
      ...d,
      device: { ...d.device, online },
      log: [...d.log, { t: clock(), msg: online ? 'Device reconnected.' : 'Device unreachable — connection lost.' }],
    } : d));
  }, []);

  // --- pumps (cmd/pump) -----------------------------------------------
  const setPumpDuration = useCallback((id: number, value: string) => {
    const clean = value.replace(/[^0-9]/g, '').slice(0, 4);
    setPumps((ps) => ps.map((p) => (p.id === id ? { ...p, durationInput: clean } : p)));
  }, []);

  const togglePump = useCallback((id: number) => {
    if (!canCommand) return;
    setPumps((ps) => ps.map((p) => {
      if (p.id !== id) return p;
      if (p.on) {
        pushLog(`Pump ${id} (${p.role}) stopped.`);
        return { ...p, on: false, remaining: null };
      }
      const d = parseInt(p.durationInput, 10);
      const duration = Number.isNaN(d) || d <= 0 ? null : d;
      pushLog(`Pump ${id} (${p.role}) started — ${duration ? `${duration}s.` : 'indefinite.'}`);
      return { ...p, on: true, remaining: duration };
    }));
  }, [canCommand, pushLog]);

  // --- sequences (cmd/sequence, cmd/stop) ------------------------------
  const startSequence = useCallback((steps: Step[], protocol?: Protocol | null) => {
    if (!steps.length || !canCommand) return;
    const first = steps[0];
    setPumps(freshPumps().map((p) => (
      p.id === first.pump ? { ...p, on: true, remaining: first.duration } : p
    )));
    setData((d) => ({
      ...d,
      run: {
        active: true, steps: steps.map((s) => ({ ...s })), index: 0, remaining: first.duration,
        protocolId: protocol?.id ?? null, protocolName: protocol?.name ?? null,
      },
      log: [
        ...d.log,
        { t: clock(), msg: `Sequence started — ${protocol ? `“${protocol.name}” · ` : ''}${steps.length} steps queued.` },
        { t: clock(), msg: `Pump ${first.pump} (${roleOf(first.pump)}) started — ${first.duration}s.` },
      ].slice(-40),
    }));
  }, [canCommand]);

  const stopAll = useCallback(() => {
    setPumps(freshPumps());
    setData((d) => ({
      ...d,
      run: d.run ? { ...d.run, active: false } : null,
      log: [...d.log, { t: clock(), msg: 'STOP ALL received — all pumps halted.' }].slice(-40),
    }));
  }, []);

  // --- 1 Hz tick, standing in for inbound easyblot/status --------------
  const updateUserRef = useRef(updateUser);
  updateUserRef.current = updateUser;

  useEffect(() => {
    const id = window.setInterval(() => {
      setData((d) => {
        if (!d.run?.active) return d;
        const run = { ...d.run, remaining: d.run.remaining - 1 };
        if (run.remaining > 0) return { ...d, run };

        const done = run.steps[run.index];
        const log = [...d.log, { t: clock(), msg: `Pump ${done.pump} (${roleOf(done.pump)}) complete.` }];

        if (run.index < run.steps.length - 1) {
          run.index += 1;
          const next = run.steps[run.index];
          run.remaining = next.duration;
          log.push({ t: clock(), msg: `Pump ${next.pump} (${roleOf(next.pump)}) started — ${next.duration}s.` });
          setPumps(freshPumps().map((p) => (
            p.id === next.pump ? { ...p, on: true, remaining: next.duration } : p
          )));
          return { ...d, run, log: log.slice(-40) };
        }

        // Sequence finished: one completed blot.
        run.active = false;
        run.remaining = 0;
        log.push({ t: clock(), msg: 'Sequence complete — blot logged.' });
        setPumps(freshPumps());

        const weeklyUsage = [...d.weeklyUsage];
        weeklyUsage[todayIndex()] += 1;
        const protocols = d.protocols.map((p) => (
          p.id === run.protocolId ? { ...p, runCount: p.runCount + 1, lastRun: 'Just now' } : p
        ));

        void updateUserRef.current({}).catch(() => {});
        return { ...d, run, log: log.slice(-40), weeklyUsage, protocols };
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  // Credit the account when a run finishes, and mirror live state for the
  // leaderboard's "running now" indicator.
  const runActive = !!data.run?.active;
  const completedRuns = data.weeklyUsage.reduce((a, b) => a + b, 0);
  const lastCredited = useRef<number | null>(null);

  useEffect(() => {
    if (!user) return;
    if (lastCredited.current === null) { lastCredited.current = completedRuns; return; }
    if (completedRuns > lastCredited.current) {
      const delta = completedRuns - lastCredited.current;
      lastCredited.current = completedRuns;
      void updateUser({
        blotsWeek: user.blotsWeek + delta,
        blotsTotal: user.blotsTotal + delta,
      });
    }
  }, [completedRuns, user, updateUser]);

  useEffect(() => {
    if (user && user.activeNow !== runActive) void updateUser({ activeNow: runActive });
  }, [runActive, user, updateUser]);

  // --- protocols -------------------------------------------------------
  const saveProtocol = useCallback((p: Omit<Protocol, 'id' | 'runCount' | 'lastRun'>, id?: string | null) => {
    let saved!: Protocol;
    setData((d) => {
      if (id && d.protocols.some((x) => x.id === id)) {
        const protocols = d.protocols.map((x) => {
          if (x.id !== id) return x;
          saved = { ...x, name: p.name, note: p.note, steps: p.steps.map((s) => ({ ...s })) };
          return saved;
        });
        return { ...d, protocols };
      }
      saved = { id: randomId('pro_'), name: p.name, note: p.note, steps: p.steps.map((s) => ({ ...s })), runCount: 0, lastRun: null };
      return { ...d, protocols: [...d.protocols, saved] };
    });
    return saved;
  }, []);

  const deleteProtocol = useCallback((id: string) => {
    setData((d) => ({ ...d, protocols: d.protocols.filter((p) => p.id !== id) }));
  }, []);

  const duplicateProtocol = useCallback((id: string) => {
    setData((d) => {
      const p = d.protocols.find((x) => x.id === id);
      if (!p) return d;
      const taken = (n: string) => d.protocols.some((x) => x.name.toLowerCase() === n.toLowerCase());
      let name = `${p.name} (copy)`;
      let n = 2;
      while (taken(name)) name = `${p.name} (copy ${n++})`;
      const copy: Protocol = { ...p, id: randomId('pro_'), name, runCount: 0, lastRun: null, steps: p.steps.map((s) => ({ ...s })) };
      const at = d.protocols.indexOf(p) + 1;
      return { ...d, protocols: [...d.protocols.slice(0, at), copy, ...d.protocols.slice(at)] };
    });
  }, []);

  // --- forum -----------------------------------------------------------
  const addThread = useCallback((t: { title: string; body: string; category: string }) => {
    const thread: Thread = {
      id: randomId('thr_'), category: t.category, authorId: user!.id,
      author: user!.displayName, authorInitials: user!.initials,
      title: t.title, body: t.body, createdAt: Date.now(), updatedAt: Date.now(), replies: [],
    };
    setThreads((prev) => [thread, ...prev]);
    if (user) void updateUser({ forumTotal: user.forumTotal + 1 });
    return thread;
  }, [user, updateUser]);

  const updateThread = useCallback((id: string, patch: { title?: string; body?: string; category?: string }) => {
    setThreads((prev) => prev.map((t) => (
      t.id === id && t.authorId === user?.id ? { ...t, ...patch, updatedAt: Date.now() } : t
    )));
  }, [user]);

  const deleteThread = useCallback((id: string) => {
    setThreads((prev) => prev.filter((t) => !(t.id === id && t.authorId === user?.id)));
    if (user) void updateUser({ forumTotal: Math.max(0, user.forumTotal - 1) });
  }, [user, updateUser]);

  const addReply = useCallback((threadId: string, body: string) => {
    if (!user) return;
    setThreads((prev) => prev.map((t) => (t.id === threadId ? {
      ...t, updatedAt: Date.now(),
      replies: [...t.replies, {
        id: randomId('rep_'), authorId: user.id, author: user.displayName,
        initials: user.initials, createdAt: Date.now(), body,
      }],
    } : t)));
    void updateUser({ forumTotal: user.forumTotal + 1 });
  }, [user, updateUser]);

  const updateReply = useCallback((threadId: string, replyId: string, body: string) => {
    setThreads((prev) => prev.map((t) => (t.id === threadId ? {
      ...t,
      replies: t.replies.map((r) => (r.id === replyId && r.authorId === user?.id ? { ...r, body } : r)),
    } : t)));
  }, [user]);

  const deleteReply = useCallback((threadId: string, replyId: string) => {
    setThreads((prev) => prev.map((t) => (t.id === threadId ? {
      ...t, replies: t.replies.filter((r) => !(r.id === replyId && r.authorId === user?.id)),
    } : t)));
    if (user) void updateUser({ forumTotal: Math.max(0, user.forumTotal - 1) });
  }, [user, updateUser]);

  const value = useMemo<StoreValue>(() => ({
    ready, device: data.device, run: data.run, pumps, protocols: data.protocols,
    log: data.log, weeklyUsage: data.weeklyUsage, threads, canCommand,
    pairDevice, renameDevice, forgetDevice, setOnline,
    setPumpDuration, togglePump, startSequence, stopAll,
    saveProtocol, deleteProtocol, duplicateProtocol,
    addThread, updateThread, deleteThread, addReply, updateReply, deleteReply,
  }), [
    ready, data, pumps, threads, canCommand,
    pairDevice, renameDevice, forgetDevice, setOnline,
    setPumpDuration, togglePump, startSequence, stopAll,
    saveProtocol, deleteProtocol, duplicateProtocol,
    addThread, updateThread, deleteThread, addReply, updateReply, deleteReply,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
