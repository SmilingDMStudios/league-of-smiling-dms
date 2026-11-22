'use client';

import { useEffect } from 'react';
import markup from '../lib/markup';
import { installPlatform } from '../lib/platform';

// The tools are written as one plain-JavaScript app (public/core.js) that works on
// the markup below. Shell renders the markup, installs the platform layer
// (downloads, sign-in, Monster Archive), loads the rules data, then starts the app.
export default function Shell() {
  useEffect(() => {
    if (window.__lsdBooted) return;
    window.__lsdBooted = true;
    installPlatform();
    const note = document.createElement('div');
    note.className = 'boot-note';
    note.textContent = 'Loading the toolbox…';
    document.body.appendChild(note);
    Promise.all(
      ['srd', 'items', 'chardata'].map((n) =>
        fetch(`/data/${n}.json`).then((r) => r.text()).then((txt) => [n === 'chardata' ? 'chdata' : n, txt])
      )
    )
      .then((parts) => {
        for (const [id, txt] of parts) {
          const el = document.createElement('script');
          el.type = 'application/json';
          el.id = id;
          el.textContent = txt;
          document.body.appendChild(el);
        }
        const app = document.createElement('script');
        app.src = '/core.js';
        app.onload = () => note.remove();
        document.body.appendChild(app);
      })
      .catch(() => {
        note.textContent = 'The toolbox could not load. Check your connection and refresh.';
      });
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: markup }} />;
}
