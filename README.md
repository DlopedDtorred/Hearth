# Hearth — Open Model Directory

Hearth is a small, English-language catalog for public AI model links. Visitors
can browse the directory; users must create an account and sign in to submit a
link. **Hearth stores model metadata and URLs only. It never uploads, proxies,
or hosts model files.**

## Free setup

The frontend is static and can be hosted for free with GitHub Pages. Accounts
and model-link metadata use Supabase Auth and its free PostgreSQL database.
No service-role key, server secret, paid API, model storage, or custom backend
is required.

1. Create a free Supabase project at <https://supabase.com/dashboard>.
2. Open **SQL Editor**, paste `supabase/schema.sql`, and run it.
3. In Supabase **Project Settings → API**, copy the project URL and public
   `anon` key (do not use a `service_role` or secret key in the browser).
4. Put them in `config.js`:

   ```js
   window.HEARTH_CONFIG = {
     supabaseUrl: "https://YOUR_PROJECT.supabase.co",
     supabaseAnonKey: "YOUR_PUBLIC_ANON_KEY"
   };
   ```

5. In Supabase **Authentication → URL Configuration**, add the deployed
   website to **Site URL** and **Redirect URLs**. Enable email/password
   signups; optionally disable email confirmation while testing.
6. Push this directory to a GitHub repository. Its Pages workflow deploys on
   every push to `main`; in **Settings → Pages**, select **GitHub Actions** as
   the build and deployment source. The application is plain static HTML,
   CSS, and JavaScript.

The Supabase `anon` key is designed for browser use. Row-level security in
`schema.sql` lets visitors read public listings but only signed-in users
insert links, and authors can delete only their own listings. Never put a
service-role key in `config.js`.

## Run locally

After configuring Supabase, serve this folder from a local static HTTP server,
then open the shown URL:

```sh
python3 -m http.server 8080
```

Opening `index.html` directly with `file://` is not supported because browser
module imports and Supabase authentication need an HTTP origin.

## Data and safety

- Sign-in credentials are handled by Supabase Auth, not by Hearth.
- The database stores title, category, optional quantization, license,
  description, owner ID, timestamp, and the source URL. It stores no model
  binary, API token, or password.
- Only HTTPS URLs are accepted. External links open in a new tab with
  `rel="noopener noreferrer"`.
- Inspect the original host, publisher, license, and model card before
  downloading a community-submitted model. A catalog listing is not an
  endorsement.
- Free-tier limits and policies are set by Supabase and may change.
