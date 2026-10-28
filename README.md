# Ctrl Room

Your client mix-review app. Clients listen, leave timestamp and general notes, A/B versions and approve mixes. You track progress, deliver versions, text updates and see who listened. Client files sent through the Portal land in your Dropbox.

## Set it up (about 20 minutes)

### 1. Supabase (database, logins, mix storage)
1. Go to [supabase.com](https://supabase.com), sign up, and click **New project**. Name it `ctrl-room` and pick a region near you.
2. Open **SQL Editor › New query**. Open `supabase/schema.sql` from this repo, change `you@example.com` at the bottom to **the email you'll sign in with**, paste the whole file and click **Run**.
3. **Authentication › Sign In / Providers › Email**: make sure Email is on.
4. **Authentication › Email Templates › Magic Link**: add the code to the email so people can type it in (needed when the app is on your Dock or Home Screen). Replace the body with:
   ```html
   <h2>Your Ctrl Room sign-in</h2>
   <p>Your code: <strong>{{ .Token }}</strong></p>
   <p>Or <a href="{{ .ConfirmationURL }}">tap here to sign in</a>.</p>
   ```
5. **Authentication › URL Configuration**: set **Site URL** to your Vercel address (step 3), and add it under **Redirect URLs** as `https://YOUR-ADDRESS/**`.
6. **Project Settings › API**: copy the **Project URL**, the **anon public** key and the **service_role** key for step 3.

Mix files: Supabase's free plan limits each uploaded file to 50 MB. Full-length WAV mixes are often bigger, so either upgrade to Pro and raise the limit under **Storage › Settings**, or deliver review mixes as 16-bit/44.1k or high-quality MP3.

### 2. Dropbox (where client uploads land)
1. Go to [dropbox.com/developers/apps](https://www.dropbox.com/developers/apps) › **Create app** › **Scoped access** › **App folder** › name it `Ctrl Room`.
2. **Permissions** tab: tick `files.content.write` and `files.content.read`, click **Submit**.
3. **Settings** tab: copy the **App key** and **App secret**.
4. Get a refresh token (one time). In your browser open (with your app key):
   `https://www.dropbox.com/oauth2/authorize?client_id=APP_KEY&response_type=code&token_access_type=offline`
   Approve, copy the code, then in Terminal run:
   ```bash
   curl https://api.dropbox.com/oauth2/token -d code=THE_CODE -d grant_type=authorization_code -u APP_KEY:APP_SECRET
   ```
   Copy `refresh_token` from the reply.
Files land in `Dropbox/Apps/Ctrl Room/Clients/Artist/Project/Song/`.

### 3. Vercel (puts the app online)
1. Go to [vercel.com](https://vercel.com), sign up with GitHub, click **Add New › Project**, and import `ctrl-room`.
2. Before clicking Deploy, open **Environment Variables** and add everything from `.env.example`:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `ENGINEER_EMAIL` (same email as in the SQL)
   - `NEXT_PUBLIC_SITE_URL` (your Vercel address, e.g. `https://ctrl-room.vercel.app`)
   - `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`, `DROPBOX_REFRESH_TOKEN`
   - Twilio ones when you have them (step 4). Optional: `ENGINEER_PHONE` to get a text when a client sends files.
3. Click **Deploy**. Later you can add your own domain under **Settings › Domains**.

### 4. Twilio (texts) — can wait
Sign up at [twilio.com](https://www.twilio.com), buy a phone number, and add `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` in Vercel, then redeploy. US numbers need A2P 10DLC registration before texts go through reliably; Twilio walks you through it. Until then everything works, texts just don't send.

## Put it on your Mac and phone
- **Mac:** open your Ctrl Room address in Safari › **File › Add to Dock**. Sign in with the code from the email.
- **iPhone:** Safari › Share › **Add to Home Screen**.

## Using it
- **Start a project:** Home › **+ New project**, or send clients your Portal link (`/portal`) and they set it up themselves.
- **Share:** on a project, **Share with client** › enter their email and phone › copy the link. They sign in with that email, no password.
- **Deliver a mix:** open the song › **+ Deliver new version**. It's labeled v1, v2… automatically; tap ✎ to rename (v2.1, Radio edit…).
- **Notes, approvals, plays** show up on Home under Activity, and per song in the tabs.

## Run it locally (optional)
```bash
npm install
cp .env.example .env.local   # fill in your keys
npm run dev
```


## Share links and artist pages

Run `supabase/004_sharing_and_artists.sql` once in the Supabase SQL editor (after 002 and 003).

- **Share links**: the Share button on a song or project makes a listen-only link (`/l/…`). The engineer can switch sharing off per project or song, or reset a link.
- **Artist pages**: paste a Spotify artist link to pull in the name, photo, header and monthly listeners. Optionally add `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` (from developer.spotify.com) in Vercel for genres and followers.
