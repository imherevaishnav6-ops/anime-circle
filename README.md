# Anime Circle

Anime Circle is a public-ready anime club website for you and your friends. Everyone can create an account, log in, and save their favorite anime with a short reason.

## Stack

- Frontend: Vanilla HTML, CSS, and JavaScript
- Backend: Supabase Auth + Supabase Postgres database
- Hosting target: Vercel static deployment

## Project files

- [index.html](C:\Users\vaishnav chowdary\OneDrive\Documents\New project\index.html)
- [styles.css](C:\Users\vaishnav chowdary\OneDrive\Documents\New project\styles.css)
- [app.js](C:\Users\vaishnav chowdary\OneDrive\Documents\New project\app.js)
- [config.js](C:\Users\vaishnav chowdary\OneDrive\Documents\New project\config.js)
- [supabase/schema.sql](C:\Users\vaishnav chowdary\OneDrive\Documents\New project\supabase\schema.sql)

## What the app does

- Creates accounts with display name, username, email, and password
- Logs users in with Supabase Auth
- Saves each member's favorite anime and their reason to a cloud database
- Shows a shared member feed for the friend group

## Important note about browser storage

This app is configured with `persistSession: false`, so it does not save the login session in browser local storage. That means a user is logged out when the page reloads or closes, but the anime data itself stays in the online Supabase database.

## Setup Supabase

1. Create a project in [Supabase](https://supabase.com/).
2. Open the SQL editor and run the SQL from [supabase/schema.sql](C:\Users\vaishnav chowdary\OneDrive\Documents\New project\supabase\schema.sql).
3. In Supabase, copy your project URL and anon key.
4. Open [config.js](C:\Users\vaishnav chowdary\OneDrive\Documents\New project\config.js) and paste them in:

```js
window.APP_CONFIG = {
  supabaseUrl: "https://your-project-id.supabase.co",
  supabaseAnonKey: "your-anon-key"
};
```

5. In Supabase Auth settings, add your final website URL as the site URL.
6. If email confirmation is enabled, users will need to confirm by email before login. If you want quicker friend-group testing, you can disable email confirmation in your Supabase Auth settings.

## Deploy to Vercel

1. Put this project in a GitHub repository.
2. Import the repository into [Vercel](https://vercel.com/).
3. Deploy it as a static site.
4. After deployment, open the public Vercel URL and test sign-up, login, and favorite anime saving.

## Notes

- Anime data is stored online in Supabase, not in local files
- Login sessions are kept only in memory during the current tab session
- If you want persistent login across refreshes, change `persistSession` to `true` in [app.js](C:\Users\vaishnav chowdary\OneDrive\Documents\New project\app.js)
