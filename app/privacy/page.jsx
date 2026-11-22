export const metadata = { title: 'Privacy · The League of Smiling DMs' };

export default function Privacy() {
  return (
    <main className="wrap" style={{ padding: '40px 0', maxWidth: 760 }}>
      <p><a href="/">← Back to the toolbox</a></p>
      <h2 style={{ fontSize: 44, color: 'var(--moss)' }}>Privacy</h2>
      <p>The League of Smiling DMs is a free fan site. We keep what we collect to a minimum.</p>
      <h3 style={{ fontSize: 28, marginTop: 24 }}>What stays on your device</h3>
      <p>Characters, saved monsters, weapons and kept names are stored in your own browser. We never see them, and clearing your browser data removes them.</p>
      <h3 style={{ fontSize: 28, marginTop: 24 }}>If you sign in</h3>
      <p>Signing in is only needed to share monsters in the Monster Archive. We store your email address so we can send you sign-in links, and we store the monsters you choose to share along with the creator name you type. Shared monsters are public. You can delete your own entries at any time.</p>
      <p>Sign-in and the archive are run on Supabase, and the site is hosted on Vercel. We do not sell your information or use it for advertising.</p>
      <h3 style={{ fontSize: 28, marginTop: 24 }}>Contact</h3>
      <p>To have your account and entries removed, contact Smiling DM Studios through the site&apos;s GitHub page.</p>
    </main>
  );
}
