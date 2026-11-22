export const metadata = { title: 'Attributions · The League of Smiling DMs' };

export default function Attributions() {
  return (
    <main className="wrap" style={{ padding: '40px 0', maxWidth: 760 }}>
      <p><a href="/">← Back to the toolbox</a></p>
      <h2 style={{ fontSize: 44, color: 'var(--moss)' }}>Attributions</h2>
      <p>
        This work includes material taken from the System Reference Document 5.1 (&quot;SRD 5.1&quot;) and the System
        Reference Document 5.2.1 (&quot;SRD 5.2.1&quot;) by Wizards of the Coast LLC, available at{' '}
        <a href="https://www.dndbeyond.com/srd">dndbeyond.com/srd</a>. The SRD 5.1 and SRD 5.2.1 are licensed under the{' '}
        <a href="https://creativecommons.org/licenses/by/4.0/legalcode">Creative Commons Attribution 4.0 International License</a>.
      </p>
      <p>
        Monster, magic item, spell, class, species, background and equipment data was converted from the open-source{' '}
        <a href="https://github.com/5e-bits/5e-database">5e-database</a> project (MIT License).
      </p>
      <p>
        The Smiling DM Originals (monsters, common magic items, weapon abilities and all generator tables) are original
        works of Smiling DM Studios.
      </p>
      <p>
        The League of Smiling DMs is an unofficial fan site. It is not affiliated with, endorsed, sponsored or approved by
        Wizards of the Coast. Dungeons &amp; Dragons is a trademark of Wizards of the Coast LLC.
      </p>
    </main>
  );
}
