import { createClient } from '@supabase/supabase-js';

// Platform layer for public/core.js. The app asks `claude.use(name)` for
// "downloads", "user" and "db"; this file answers with browser downloads,
// Supabase sign-in, and a Supabase-backed Monster Archive.

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ADMIN = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || '').trim().toLowerCase();

const downloads = {
  async save({ filename, data }) {
    const blob = data instanceof Blob ? data : new Blob([data]);
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = filename || 'download';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 5000);
    return { status: 'saved' };
  },
};

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)).replace(/-/g, '').slice(0, 20);
const mapErr = (e) => ({ code: e && (e.code === '42501' || /row-level security/i.test(e.message || '')) ? 'invalid_argument' : 'unavailable', message: (e && e.message) || 'error' });

function makeDb(sb) {
  const subs = [];
  let timer = null;
  const refresh = async (onErr) => {
    const { data, error } = await sb.from('archive').select('id, body, author_id, updated').order('updated', { ascending: false }).limit(1000);
    if (error) {
      if (onErr) onErr(mapErr(error));
      return;
    }
    const docs = data.map((r) => ({ id: r.id, exists: true, data: () => ({ ...(r.body || {}), authorId: r.author_id, updated: r.updated }) }));
    subs.forEach((f) => f({ metadata: { fromCache: false, hasPendingWrites: false }, docs, size: docs.length, empty: !docs.length }));
  };
  const collection = () => ({
    limit: () => collection(),
    doc(id) {
      const docId = id || newId();
      return {
        id: docId,
        async set(body) {
          const row = { id: docId, body: { m: body.m, by: body.by || '' }, updated: body.updated || Date.now() };
          const { error } = await sb.from('archive').upsert(row);
          if (error) throw mapErr(error);
          refresh();
        },
        async delete() {
          const { error } = await sb.from('archive').delete().eq('id', docId);
          if (error) throw mapErr(error);
          refresh();
        },
      };
    },
    onSnapshot(next, onErr) {
      subs.push(next);
      refresh(onErr);
      if (!timer) timer = setInterval(() => refresh(), 30000);
      return () => {};
    },
  });
  return { collection };
}

function renderAuth(sb, session) {
  const box = document.getElementById('authbox');
  if (!box) return;
  if (session) {
    box.innerHTML = '<p>Signed in as <b></b>. <button class="btn sm" type="button" id="auth-out">Sign out</button></p>';
    box.querySelector('b').textContent = session.user.email || 'you';
    box.querySelector('#auth-out').onclick = async () => {
      await sb.auth.signOut();
      location.reload();
    };
    return;
  }
  box.innerHTML =
    '<p>Sign in to share your monsters with the League. We email you a one-time link; no password needed.</p>' +
    '<form id="auth-form"><input type="email" id="auth-email" required placeholder="you@example.com" aria-label="Email address"><button class="btn sm pri" type="submit">Email me a sign-in link</button></form>';
  box.querySelector('#auth-form').onsubmit = async (e) => {
    e.preventDefault();
    const email = box.querySelector('#auth-email').value.trim();
    const btn = box.querySelector('button');
    btn.disabled = true;
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/?go=monsters` } });
    box.querySelector('p').textContent = error ? `That didn't work: ${error.message}` : `Check ${email} for your sign-in link.`;
    btn.disabled = false;
  };
}

export function installPlatform() {
  const sb = URL_ && KEY ? createClient(URL_, KEY, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true } }) : null;
  let session = null;
  const ready = sb
    ? sb.auth.getSession().then(({ data }) => {
        session = data.session;
      })
    : Promise.resolve();

  const user = {
    id: async () => {
      await ready;
      return session ? session.user.id : null;
    },
    isOwner: async () => {
      await ready;
      return !!(session && ADMIN && (session.user.email || '').toLowerCase() === ADMIN);
    },
    canEdit: async () => user.isOwner(),
    can: async (name) => {
      await ready;
      return name === 'data.write' ? !!session : null;
    },
  };
  const db = sb ? makeDb(sb) : null;
  window.claude = { use: async (k) => (k === 'downloads' ? downloads : k === 'user' ? user : k === 'db' ? db : null) };

  ready.then(() => {
    const params = new URLSearchParams(location.search);
    if (params.has('code') || params.has('go')) {
      const go = params.get('go');
      history.replaceState(null, '', location.pathname + (go ? `#${go}` : location.hash));
      if (go) window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
    if (sb) {
      const draw = () => renderAuth(sb, session);
      if (document.getElementById('authbox')) draw();
      else document.addEventListener('DOMContentLoaded', draw);
      sb.auth.onAuthStateChange((_e, s) => {
        session = s;
        draw();
      });
    }
  });
}
