'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar, Btn, Card, ConfirmDialog, Field, Item, Modal, Page, Toggle, type ConfirmSpec } from '../../../components/ui';
import { useAuth } from '../../../lib/auth/context';
import { AuthError } from '../../../lib/auth/adapter';
import { TIER_LABEL } from '../../../lib/auth/email';
import { checkPasswordStrength } from '../../../lib/auth/crypto';
import { useStore } from '../../../lib/store';
import * as db from '../../../lib/db';

export default function SettingsPage() {
  const { user, updateUser, logOut, changePassword, deleteAccount } = useAuth();
  const { device, forgetDevice, setOnline, run } = useStore();
  const router = useRouter();

  const [confirmSpec, setConfirmSpec] = useState<ConfirmSpec | null>(null);
  const [nameOpen, setNameOpen] = useState(false);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwDone, setPwDone] = useState(false);

  if (!user) return null;

  const saveName = async () => {
    const v = name.trim();
    if (v.length < 2) { setNameError('Use at least 2 characters.'); return; }
    if (v.length > 24) { setNameError('Keep it to 24 characters or fewer.'); return; }
    if (!/^[A-Za-z0-9][A-Za-z0-9 ._-]*$/.test(v)) {
      setNameError('Letters, numbers, spaces, and . _ - only.'); return;
    }
    try { await updateUser({ displayName: v }); setNameOpen(false); }
    catch (err) { setNameError(err instanceof AuthError ? err.message : 'Could not save that name.'); }
  };

  const savePassword = async () => {
    const strength = checkPasswordStrength(pw.next);
    if (!pw.current) { setPwError('Enter your current password.'); return; }
    if (!strength.ok) { setPwError(strength.message); return; }
    if (pw.next === pw.current) { setPwError('New password must differ from the current one.'); return; }
    if (pw.next !== pw.confirm) { setPwError('The two new passwords do not match.'); return; }
    try {
      await changePassword(pw.current, pw.next);
      setPwDone(true);
      setPw({ current: '', next: '', confirm: '' });
    } catch (err) {
      setPwError(err instanceof AuthError ? err.message : 'Could not change the password.');
    }
  };

  return (
    <Page>
      <Item className="page-head"><h1>Settings</h1></Item>

      {/* ---- Profile ---- */}
      <Item><div className="eyebrow">Profile</div></Item>
      <Item>
        <Card>
          <div className="lrow" style={{ border: 'none' }}>
            <Avatar user={{ initials: user.initials, activeNow: !!run?.active }} size="lg" />
            <div className="grow">
              <div className="name" style={{ fontSize: 16 }}>{user.displayName}</div>
              <div className="meta">Public display name</div>
            </div>
            <Btn size="sm" variant="ghost" onClick={() => { setName(user.displayName); setNameError(null); setNameOpen(true); }}>
              Edit
            </Btn>
          </div>
          <div className="divider" />
          <SettingRow label="Account" value={TIER_LABEL[user.tier]} tag={user.verified ? 'Verified' : 'Unverified'} />
          <SettingRow label="Real name" value={user.realName} tag="Private" />
          {user.tier === 'institution' && (
            <SettingRow label="Institution" value={user.institution || '—'}
              tag={user.showInstitution ? 'Public' : 'Private'} />
          )}
        </Card>
      </Item>

      {/* ---- Privacy ---- */}
      {user.tier === 'institution' && (
        <>
          <Item><div className="eyebrow">Privacy</div></Item>
          <Item>
            <Card>
              <div className="row">
                <div className="grow"><div className="name">Show my institution on my public profile</div></div>
                <Toggle on={user.showInstitution} label="Show institution"
                  onChange={(v) => updateUser({ showInstitution: v })} />
              </div>
              <div className="caption" style={{ marginTop: 10 }}>
                Off = your institution stays private on the leaderboard and forum. Only your display name is shown.
              </div>
            </Card>
          </Item>
        </>
      )}

      {/* ---- Device ---- */}
      <Item><div className="eyebrow">Device</div></Item>
      <Item>
        <Card>
          {device ? (
            <>
              <SettingRow label="Paired device" value={device.name} tag={device.online ? 'Online' : 'Offline'} />
              <SettingRow label="Network" value={device.wifi} />
              <SettingRow label="Address" value={device.mdns} />
              <div className="divider" />
              <div className="row" style={{ marginBottom: 12 }}>
                <div className="grow"><div className="caption">Simulate offline (prototype only)</div></div>
                <Toggle on={!device.online} label="Simulate offline" onChange={(v) => setOnline(!v)} />
              </div>
              <button className="linkbtn danger" onClick={() => setConfirmSpec({
                title: `Forget ${device.name}?`,
                body: 'This account loses control of the unit and all quick actions are disabled.',
                confirmLabel: 'Forget device', destructive: true, onConfirm: forgetDevice,
              })}>Forget device</button>
            </>
          ) : (
            <div className="caption">No device paired. Pair one from Home.</div>
          )}
        </Card>
      </Item>

      {/* ---- Account ---- */}
      <Item><div className="eyebrow">Account</div></Item>
      <Item>
        <Card>
          <SettingRow label="Email" value={user.email} tag={user.verified ? 'Verified' : 'Unverified'} />
          <div className="divider" />
          <div className="stack" style={{ gap: 14, alignItems: 'flex-start' }}>
            <button className="linkbtn" onClick={() => { setPwError(null); setPwDone(false); setPwOpen(true); }}>
              Change password
            </button>
            <button className="linkbtn" onClick={() => setConfirmSpec({
              title: 'Reset local data?',
              body: 'Deletes every EasyBlot account, protocol, and forum post stored in this browser. There is no undo.',
              confirmLabel: 'Reset everything', destructive: true,
              onConfirm: async () => { await db.clearAll(); window.location.href = '/signup'; },
            })}>Reset local data</button>
            <button className="linkbtn danger" onClick={() => setConfirmSpec({
              title: 'Delete your account?',
              body: 'Your account, protocols, and device pairing are removed from this browser.',
              confirmLabel: 'Delete account', destructive: true,
              onConfirm: async () => { await deleteAccount(); router.push('/signup'); },
            })}>Delete account</button>
            <button className="linkbtn danger" onClick={() => setConfirmSpec({
              title: 'Log out?',
              body: 'You will need your email and password to sign back in.',
              confirmLabel: 'Log out', destructive: true,
              onConfirm: async () => { await logOut(); router.push('/login'); },
            })}>Log out</button>
          </div>
        </Card>
      </Item>

      <Item>
        <div className="caption" style={{ textAlign: 'center', padding: '6px 0 10px' }}>
          EasyBlot web · local account storage
        </div>
      </Item>

      <Modal open={nameOpen} onClose={() => setNameOpen(false)}>
        <h2>Edit display name</h2>
        <p className="sub">This is what appears on the leaderboard and forum. Your real name stays private.</p>
        <div style={{ height: 16 }} />
        <Field label="Display name" error={nameError} hint="2–24 characters. Letters, numbers, spaces, and . _ - only.">
          <input className={`input${nameError ? ' error' : ''}`} value={name} maxLength={24}
            onChange={(e) => { setName(e.target.value); setNameError(null); }} />
        </Field>
        <div className="modal-actions">
          <Btn variant="ghost" onClick={() => setNameOpen(false)}>Cancel</Btn>
          <Btn onClick={saveName}>Save</Btn>
        </div>
      </Modal>

      <Modal open={pwOpen} onClose={() => setPwOpen(false)}>
        <h2>{pwDone ? 'Password updated' : 'Change password'}</h2>
        {pwDone ? (
          <>
            <p className="sub">Your password has been changed.</p>
            <div className="modal-actions">
              <Btn block onClick={() => setPwOpen(false)}>Done</Btn>
            </div>
          </>
        ) : (
          <>
            <div style={{ height: 14 }} />
            <Field label="Current password">
              <input className="input" type="password" value={pw.current}
                onChange={(e) => { setPw({ ...pw, current: e.target.value }); setPwError(null); }} />
            </Field>
            <Field label="New password" hint="At least 8 characters, with a letter and a number.">
              <input className="input" type="password" value={pw.next}
                onChange={(e) => { setPw({ ...pw, next: e.target.value }); setPwError(null); }} />
            </Field>
            <Field label="Confirm new password" error={pwError}>
              <input className="input" type="password" value={pw.confirm}
                onChange={(e) => { setPw({ ...pw, confirm: e.target.value }); setPwError(null); }} />
            </Field>
            <div className="modal-actions">
              <Btn variant="ghost" onClick={() => setPwOpen(false)}>Cancel</Btn>
              <Btn onClick={savePassword}>Update</Btn>
            </div>
          </>
        )}
      </Modal>

      <ConfirmDialog spec={confirmSpec} onClose={() => setConfirmSpec(null)} />
    </Page>
  );
}

function SettingRow({ label, value, tag }: { label: string; value: string; tag?: string }) {
  return (
    <div className="row" style={{ padding: '9px 0' }}>
      <div className="caption" style={{ flex: '0 0 108px' }}>{label}</div>
      <div className="grow" style={{ fontSize: 14, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {value}
      </div>
      {tag && <span className={`pill${tag === 'Verified' || tag === 'Online' ? ' ok' : ''}`}>{tag}</span>}
    </div>
  );
}
