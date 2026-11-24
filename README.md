# OMS LDT — Overtime Management System

A lightweight shared web dashboard for Prafinda and Ahzka. Static frontend hosted on GitHub Pages; Supabase provides authentication and the shared database.

## Features
- Login with Supabase email/password (no public sign-up form).
- Monthly dashboard totals for the team, Prafinda, Ahzka, and Weekend.
- Calendar with member markers and upcoming schedules.
- Add, edit, delete, search, and filter schedules.
- Overtime type defaults automatically from the selected date:
  - Monday–Friday: Weekdays
  - Saturday–Sunday: Weekend
  The type remains editable in case the team's policy requires an exception.
- Responsive layout for desktop and mobile.

## 1. Create Supabase project
1. Create a free project at https://supabase.com/.
2. In Project Settings > API, copy the Project URL and `anon` / publishable key.
3. Open SQL Editor and run the contents of `supabase-schema.sql` after replacing:
   - `PRAFINDA_EMAIL@example.com`
   - `AHZKA_EMAIL@example.com`
   with the exact sign-in email addresses for Prafinda and Ahzka.
4. In Authentication > Providers, ensure Email is enabled.
5. In Authentication > Users, create/invite exactly the two users. Set a password for each. Keep public sign-ups disabled.
6. In Authentication > URL Configuration, add the deployed GitHub Pages URL to Site URL and Redirect URLs, e.g. `https://USERNAME.github.io/REPOSITORY/`.

## 2. Configure frontend
Edit `config.js` and replace:
```js
window.OMS_CONFIG = {
  SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "YOUR_ANON_OR_PUBLISHABLE_KEY"
};
```
with the Project URL and `anon` / publishable key from Supabase.

The anon/publishable key is intended for browser use. Never put a `service_role` or secret key in frontend files. Access is protected by Supabase Auth and the row-level security policies in the SQL file.

## 3. Publish with GitHub Pages
1. Create a GitHub repository. For a private internal tool, the repository can be private if your GitHub plan supports Pages for private repositories; otherwise use a public repository but do not commit secrets.
2. Upload `index.html`, `styles.css`, `config.js`, and `app.js` to the repository root. `supabase-schema.sql` and this README may also be committed; they contain email placeholders until configured.
3. In repository Settings > Pages, choose Deploy from a branch, select `main` and `/ (root)`, then Save.
4. Wait for GitHub Pages to publish and open the provided URL.
5. Add that URL to Supabase Auth URL Configuration as described above.

## Important security notes
- GitHub Pages is static hosting; it does not provide server-side secrets or enforce access control itself.
- Do not rely on a hidden URL. Supabase Auth and RLS are what protect the data.
- The SQL policies restrict access to the two exact email addresses. Replace both placeholders before enabling the app.
- Do not expose Supabase service-role keys.
- Anyone who can access either allowed account can view and change shared schedules. Use strong, unique passwords.

## Current scope / known limitations
- No approval workflow, overtime-hour calculation, attachments, or export yet, by design.
- Calendar markers show the member; type is shown in agenda/list details.
- The dashboard refreshes on load and after changes. Supabase Realtime subscription is included; enable the `overtime_schedules` table in Supabase Realtime/replication settings if cross-device push updates do not arrive.
