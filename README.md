# Invitation

The GitHub Pages site serves public invitation links. The admin portal is at
`/admin.html`; it uses Supabase email/password authentication, with the login
screen asking only for the password. Admin event edits are stored in Supabase,
so public invitation pages update in real time.

Until Supabase is connected, the public page shows a clearly labeled preview
and the admin portal remains unavailable.

## One-time setup

1. Create a Supabase project.
2. In Supabase Authentication, create and confirm your own admin user with an
   email and a strong password. Disable public sign-ups; only your account
   should exist.
3. Run [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL Editor.
4. In the SQL Editor, add your account as the sole invitation admin. Replace
   the example UUID with your user's ID from **Authentication → Users**:

   ```sql
   insert into public.invitation_admins (user_id)
   values ('YOUR-AUTH-USER-UUID');
   ```

5. Edit [`supabase-config.js`](supabase-config.js) with your Supabase Project
   URL, the **anon/public** key, and the same admin email used in step 2.
   Never put a Supabase service-role key or your password in this file.
6. Push the changes to GitHub. GitHub Pages will deploy the portal and public
   invitation automatically.

Sign in at `https://ahmedadelabosaif.github.io/invitation/admin.html`. Add or
edit events, mark an event public to enable its share link, and optionally set
it as the main invitation. The main invitation is available at the site root;
other event links include `?event=<event-id>`. Public guests cannot access
private events or make changes. Keep public sign-ups disabled and only add your
own user ID to `invitation_admins`.

The SQL script seeds the current sample wedding invitation. Replace its sample
details in the admin portal. Changes publish to the database immediately;
open guest pages receive live updates, with periodic refresh as a fallback.
