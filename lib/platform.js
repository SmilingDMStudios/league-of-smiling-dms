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
    const names = {};
    const ids = [...new Set(data.map((r) => r.author_id).filter(Boolean))];
    if (ids.length) {
      const { data: nicks } = await sb.from('nicknames').select('user_id, nickname').in('user_id', ids);
      (nicks || []).forEach((n) => (names[n.user_id] = n.nickname));
    }
    const docs = data.map((r) => ({ id: r.id, exists: true, data: () => ({ ...(r.body || {}), by: names[r.author_id] || (r.body && r.body.by) || '', authorId: r.author_id, updated: r.updated }) }));
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

const PENDING = 'sdm-pending-nick';
const cleanNick = (v) => String(v || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
const nickOk = (v) => v.length >= 2 && /^[\p{L}\p{N} '._-]+$/u.test(v);
const NICK_RULE = '2 to 24 letters, numbers, spaces, or . _ \' -';
let MY_NICK = '';
let PROMPT_NOTE = '';
const nickOf = (session) => (session ? MY_NICK : '');
async function loadNick(sb, session) {
  MY_NICK = '';
  if (!session) return;
  const { data } = await sb.from('nicknames').select('nickname').eq('user_id', session.user.id).maybeSingle();
  MY_NICK = cleanNick(data && data.nickname);
}
const STATUS_MSG = { taken: 'That nickname is already taken. Try another.', reserved: 'That nickname is reserved. Try another.', short: 'Nicknames need at least 2 characters.' };
async function nickProblem(sb, nick) {
  if (!nickOk(nick)) return `Nicknames need ${NICK_RULE}.`;
  const { data, error } = await sb.rpc('nickname_status', { n: nick });
  if (error) return null; // let the save itself decide
  return data === 'ok' ? null : STATUS_MSG[data] || 'That nickname is not available.';
}

function publishNick(n) {
  if (window.__lsdNick === n) return;
  window.__lsdNick = n;
  window.dispatchEvent(new Event('lsd-nick'));
}

// Rename the author on this person's archive posts so old monsters match the new nickname.
async function retagPosts(sb, uid, nick) {
  const { data } = await sb.from('archive').select('id, body').eq('author_id', uid);
  for (const row of data || []) {
    if (row.body && row.body.by !== nick) await sb.from('archive').update({ body: { ...row.body, by: nick } }).eq('id', row.id);
  }
}

async function saveNick(sb, session, nick) {
  const problem = await nickProblem(sb, nick);
  if (problem) return problem;
  const { error } = await sb.from('nicknames').upsert({ user_id: session.user.id, nickname: nick, updated_at: new Date().toISOString() });
  if (error) {
    if (error.code === '23505') return STATUS_MSG.taken;
    if (error.code === '42501' || /row-level security/i.test(error.message || '')) return STATUS_MSG.reserved;
    return error.message;
  }
  MY_NICK = nick;
  try {
    await retagPosts(sb, session.user.id, nick);
  } catch (e) {}
  return null;
}

function goToSignIn() {
  const show = () => {
    const box = document.getElementById('authbox');
    if (!box) return;
    // The archive sits in a sticky column, so one scroll can land short; settle it twice.
    box.scrollIntoView({ block: 'center' });
    setTimeout(() => {
      box.scrollIntoView({ block: 'center' });
      const input = box.querySelector('input');
      if (input) input.focus({ preventScroll: true });
    }, 250);
  };
  if (location.hash !== '#monsters') {
    location.hash = 'monsters';
    setTimeout(show, 200);
  } else show();
}

function renderAcct(session) {
  const btn = document.getElementById('acct-btn');
  if (!btn) return;
  const email = session ? session.user.email || '' : '';
  const nick = nickOf(session);
  btn.hidden = false;
  btn.classList.toggle('in', !!session);
  btn.querySelector('#acct-lbl').textContent = session ? nick || email.split('@')[0] || 'Signed in' : 'Sign in';
  btn.title = session ? `Signed in as ${nick ? nick + ' (' + email + ')' : email}` : 'Sign in to share monsters with the League';
  btn.setAttribute('aria-label', session ? `Account: signed in as ${nick || email}` : 'Sign in');
  btn.onclick = goToSignIn;
}

const nickForm = (label, value, button, note) =>
  `<p>${note}</p><form id="nick-form" class="nick-form"><label class="f" for="nick-in">${label}</label><div class="auth-row"><input id="nick-in" maxlength="24" required placeholder="e.g. Grimble the Kind"><button class="btn sm pri" type="submit">${button}</button></div><small class="muted">${NICK_RULE}</small></form>`;

function renderAuth(sb, session, redraw) {
  renderAcct(session);
  publishNick(nickOf(session));
  const box = document.getElementById('authbox');
  if (!box) return;
  if (session) {
    const nick = nickOf(session);
    const bindNick = (onDone) => {
      const f = box.querySelector('#nick-form');
      const input = f.querySelector('#nick-in');
      input.value = nick;
      f.onsubmit = async (e) => {
        e.preventDefault();
        const v = cleanNick(input.value);
        const msg = box.querySelector('small');
        if (!nickOk(v)) {
          msg.textContent = `Nicknames need ${NICK_RULE}.`;
          return;
        }
        f.querySelector('button').disabled = true;
        const err = await saveNick(sb, session, v);
        if (err) {
          msg.textContent = err;
          f.querySelector('button').disabled = false;
          return;
        }
        onDone();
      };
    };
    if (!nick) {
      box.innerHTML = nickForm('Your League nickname', '', 'Save nickname', 'One last step: pick the nickname that shows on everything you make here. Nicknames are one of a kind.');
      if (PROMPT_NOTE) {
        box.querySelector('small').textContent = PROMPT_NOTE;
        PROMPT_NOTE = '';
      }
      bindNick(() => redraw());
      return;
    }
    box.innerHTML = '<p>Signed in as <b></b> <span class="muted"></span></p><div class="bar"><button class="btn sm" type="button" id="nick-edit">Change nickname</button><button class="btn sm" type="button" id="auth-out">Sign out</button></div>';
    box.querySelector('b').textContent = nick;
    box.querySelector('.muted').textContent = `(${session.user.email || ''})`;
    box.querySelector('#nick-edit').onclick = () => {
      box.innerHTML = nickForm('New nickname', nick, 'Save', 'Your nickname shows on your monsters, characters and weapons, and no one else can use it. Changing it also updates your monsters in the archive.');
      bindNick(() => redraw());
      box.querySelector('#nick-in').focus();
    };
    box.querySelector('#auth-out').onclick = async () => {
      await sb.auth.signOut();
      location.reload();
    };
    return;
  }
  box.innerHTML =
    '<p>Sign in to share your monsters with the League. We email you a one-time link; no password needed.</p>' +
    '<form id="auth-form" class="auth-form"><label class="f" for="auth-nick">Nickname <span class="muted">(shows on everything you make)</span></label><input id="auth-nick" maxlength="24" placeholder="e.g. Grimble the Kind" autocomplete="nickname"><label class="f" for="auth-email">Email</label><div class="auth-row"><input type="email" id="auth-email" required placeholder="you@example.com" aria-label="Email address" autocomplete="email"><button class="btn sm pri" type="submit">Email me a sign-in link</button></div><small class="muted">Already a member? You can leave the nickname blank.</small></form>';
  box.querySelector('#auth-form').onsubmit = async (e) => {
    e.preventDefault();
    const email = box.querySelector('#auth-email').value.trim();
    const nick = cleanNick(box.querySelector('#auth-nick').value);
    const msg = box.querySelector('small');
    const btn = box.querySelector('button');
    btn.disabled = true;
    const problem = nick ? await nickProblem(sb, nick) : null;
    if (problem) {
      msg.textContent = problem;
      btn.disabled = false;
      box.querySelector('#auth-nick').focus();
      return;
    }
    try {
      if (nick) localStorage.setItem(PENDING, nick);
      else localStorage.removeItem(PENDING);
    } catch (err) {}
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/?go=monsters` },
    });
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
      const draw = () => renderAuth(sb, session, draw);
      // A nickname typed before the sign-in link was sent is claimed once the link brings the user back.
      const applyPending = async () => {
        let pending = '';
        try {
          pending = cleanNick(localStorage.getItem(PENDING) || '');
          localStorage.removeItem(PENDING);
        } catch (e) {}
        if (!session || !pending || pending === MY_NICK) return;
        const err = await saveNick(sb, session, pending);
        if (err) PROMPT_NOTE = `${err} Pick another nickname to finish signing in.`;
        draw();
      };
      let lastUser = session ? session.user.id : null;
      const start = async () => {
        await loadNick(sb, session);
        if (document.getElementById('authbox')) draw();
        else document.addEventListener('DOMContentLoaded', draw);
        await applyPending();
      };
      start();
      sb.auth.onAuthStateChange((evt, s) => {
        session = s;
        const uid = s ? s.user.id : null;
        if (uid === lastUser) return draw();
        lastUser = uid;
        // Supabase advises against awaiting its own calls inside this callback.
        setTimeout(async () => {
          await loadNick(sb, session);
          draw();
          await applyPending();
        }, 0);
      });
    }
  });
}
