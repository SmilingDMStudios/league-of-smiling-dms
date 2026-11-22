# The League of Smiling DMs

Free tools for Dungeon Masters and players, by Smiling DM Studios: name generator, monster stat blocks, encounter calculator, random encounters, tavern and shop generator, quest generator, loot generator, travel and weather planner, rules lookup, character builder and weapon creator.

Built with Next.js. Sign-in and the Monster Archive use Supabase. Everything else runs in the visitor's browser.

## Going live on Vercel

1. In Vercel, click **Add New → Project**, import `SmilingDMStudios/league-of-smiling-dms`, and click **Deploy**. No settings need changing. The site works right away; the Monster Archive shows "coming soon" until step 3.
2. Add your domain: **Project → Settings → Domains → Add**, then follow the DNS instructions Vercel shows you.
3. Turn on the Monster Archive (below).

## Turning on the Monster Archive (Supabase)

1. Create a project at [supabase.com](https://supabase.com) (the free plan is fine).
2. In Supabase, open **SQL Editor → New query**, paste everything from [`supabase/schema.sql`](supabase/schema.sql), and click **Run**.
3. In Supabase, open **Authentication → URL Configuration**:
   - **Site URL**: your live address, e.g. `https://leagueofsmilingdms.com`
   - **Redirect URLs**: add `https://leagueofsmilingdms.com/**` (and your `*.vercel.app` address if you use it).
4. In Supabase, open **Project Settings → API** and copy the **Project URL** and the **anon public** key.
5. In Vercel, open **Project → Settings → Environment Variables** and add:
   - `NEXT_PUBLIC_SUPABASE_URL` = the Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the anon public key
   - `NEXT_PUBLIC_ADMIN_EMAIL` = your email (shows delete buttons on every archive entry)
6. In Vercel, open **Deployments**, click **⋯** on the latest one, and choose **Redeploy**.
7. Sign in on the site once with your admin email, then in the Supabase SQL Editor run this so your deletes are allowed:

   ```sql
   insert into public.admins (user_id) select id from auth.users where email = 'YOUR-EMAIL';
   ```

Supabase's built-in email sender is limited to a few sign-in emails per hour. Before a big launch, connect your own email service under **Authentication → Emails → SMTP Settings** (Resend, Postmark and similar have free tiers).

## Working on the site locally

```bash
npm install
cp .env.example .env.local   # optional: fill in Supabase values
npm run dev
```

## How it's put together

- `app/Shell.jsx` renders the page, loads the rules data from `public/data/`, then starts the tools in `public/core.js`.
- `lib/platform.js` connects the tools to browser downloads, Supabase sign-in and the Monster Archive.
- `public/data/` holds monster, magic item, spell and character data from the SRD 5.1 and 5.2.1 (CC-BY-4.0). See `/attributions` on the site.

Not affiliated with or endorsed by Wizards of the Coast.
