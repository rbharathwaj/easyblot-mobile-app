'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Btn, Card, ConfirmDialog, Empty, Field, Item, Modal, Page, type ConfirmSpec } from '../../../../components/ui';
import { rowVariants } from '../../../../components/motion';
import { useStore } from '../../../../lib/store';
import { useAuth } from '../../../../lib/auth/context';
import { FORUM_CATEGORIES } from '../../../../lib/types';

const ago = (ts: number) => {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
};

export default function ThreadPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { threads, addReply, updateReply, deleteReply, updateThread, deleteThread } = useStore();

  const thread = threads.find((t) => t.id === id);
  const [reply, setReply] = useState('');
  const [confirmSpec, setConfirmSpec] = useState<ConfirmSpec | null>(null);
  const [editingThread, setEditingThread] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editCategory, setEditCategory] = useState<string>(FORUM_CATEGORIES[0]);
  const [editingReply, setEditingReply] = useState<{ id: string; body: string } | null>(null);

  if (!thread) {
    return (
      <Page>
        <Item className="page-head"><h1>Thread</h1></Item>
        <Item>
          <Card>
            <Empty title="That thread is gone" action={<Btn size="sm" onClick={() => router.push('/forum')}>Back to forum</Btn>}>
              It may have been deleted by its author.
            </Empty>
          </Card>
        </Item>
      </Page>
    );
  }

  const mine = thread.authorId === user?.id;

  return (
    <Page>
      <Item className="page-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <button className="iconbtn" onClick={() => router.push('/forum')} aria-label="Back">‹</button>
          <span className="pill">{thread.category}</span>
        </div>
      </Item>

      <Item>
        <h1 style={{ lineHeight: 1.25 }}>{thread.title}</h1>
        <div className="lrow" style={{ border: 'none' }}>
          <span className="avatar sm outline">{thread.authorInitials}</span>
          <div className="grow">
            <div className="name-row">
              <span className="name">{thread.author}</span>
              {mine && <span className="caption">· you</span>}
            </div>
            <div className="meta">{ago(thread.createdAt)}</div>
          </div>
        </div>
        <div className="post" style={{ paddingTop: 6 }}>
          <div className="body">{thread.body}</div>
          {mine && (
            <div className="owner-acts">
              <button className="linkbtn" onClick={() => {
                setEditTitle(thread.title); setEditBody(thread.body);
                setEditCategory(thread.category); setEditingThread(true);
              }}>Edit</button>
              <button className="linkbtn danger" onClick={() => setConfirmSpec({
                title: 'Delete this thread?',
                body: `The post and all ${thread.replies.length} ${thread.replies.length === 1 ? 'reply' : 'replies'} are removed for everyone.`,
                confirmLabel: 'Delete', destructive: true,
                onConfirm: () => { deleteThread(thread.id); router.push('/forum'); },
              })}>Delete</button>
            </div>
          )}
        </div>
      </Item>

      <Item>
        <div className="eyebrow" style={{ marginTop: 18 }}>
          {thread.replies.length} {thread.replies.length === 1 ? 'reply' : 'replies'}
        </div>
      </Item>

      <Item>
        {!thread.replies.length ? (
          <Card flat><div className="caption">No replies yet. Add what you know.</div></Card>
        ) : (
          <AnimatePresence initial={false}>
            {thread.replies.map((r) => {
              const isMine = r.authorId === user?.id;
              return (
                <motion.div key={r.id} className="post" variants={rowVariants} initial="hidden" animate="show" exit="exit" layout>
                  <div className="lrow" style={{ border: 'none', padding: '4px 0 0' }}>
                    <span className="avatar sm outline">{r.initials}</span>
                    <div className="grow">
                      <div className="name-row">
                        <span className="name">{r.author}</span>
                        {isMine && <span className="caption">· you</span>}
                      </div>
                      <div className="meta">{ago(r.createdAt)}</div>
                    </div>
                  </div>
                  <div className="body">{r.body}</div>
                  {isMine && (
                    <div className="owner-acts">
                      <button className="linkbtn" onClick={() => setEditingReply({ id: r.id, body: r.body })}>Edit</button>
                      <button className="linkbtn danger" onClick={() => setConfirmSpec({
                        title: 'Delete this reply?',
                        body: 'It is removed from the thread for everyone.',
                        confirmLabel: 'Delete', destructive: true,
                        onConfirm: () => deleteReply(thread.id, r.id),
                      })}>Delete</button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </Item>

      <Item>
        <div className="reply-bar">
          <input className="input grow" placeholder="Write a reply…" value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && reply.trim()) { addReply(thread.id, reply.trim()); setReply(''); } }} />
          <Btn size="sm" disabled={!reply.trim()}
            onClick={() => { addReply(thread.id, reply.trim()); setReply(''); }}>Post</Btn>
        </div>
      </Item>

      <Modal open={editingThread} onClose={() => setEditingThread(false)}>
        <h2>Edit post</h2>
        <div style={{ height: 14 }} />
        <Field label="Category">
          <select className="input" value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>
            {FORUM_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Title">
          <input className="input" value={editTitle} maxLength={120} onChange={(e) => setEditTitle(e.target.value)} />
        </Field>
        <Field label="Body">
          <textarea className="input" rows={5} value={editBody} onChange={(e) => setEditBody(e.target.value)} />
        </Field>
        <div className="modal-actions">
          <Btn variant="ghost" onClick={() => setEditingThread(false)}>Cancel</Btn>
          <Btn disabled={editTitle.trim().length < 6} onClick={() => {
            updateThread(thread.id, { title: editTitle.trim(), body: editBody.trim(), category: editCategory });
            setEditingThread(false);
          }}>Save changes</Btn>
        </div>
      </Modal>

      <Modal open={!!editingReply} onClose={() => setEditingReply(null)}>
        <h2>Edit reply</h2>
        <div style={{ height: 14 }} />
        <Field label="Reply">
          <textarea className="input" rows={5} value={editingReply?.body ?? ''}
            onChange={(e) => setEditingReply((p) => (p ? { ...p, body: e.target.value } : p))} />
        </Field>
        <div className="modal-actions">
          <Btn variant="ghost" onClick={() => setEditingReply(null)}>Cancel</Btn>
          <Btn disabled={!editingReply?.body.trim()} onClick={() => {
            if (editingReply) updateReply(thread.id, editingReply.id, editingReply.body.trim());
            setEditingReply(null);
          }}>Save</Btn>
        </div>
      </Modal>

      <ConfirmDialog spec={confirmSpec} onClose={() => setConfirmSpec(null)} />
    </Page>
  );
}
