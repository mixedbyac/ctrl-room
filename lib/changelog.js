// The "What's new" log. Newest first. Add an entry with every update.
// for: 'all' | 'engineer' | 'client' — who sees the item.
export const CHANGELOG = [
  { id: 'apple-style-tracklist', date: '2026-10-28', title: 'Tap a song to play it', items: [
    { for: 'all', text: 'Like an album in Apple Music: tap any song in a project to play it. No need to open its page.' },
    { for: 'all', text: 'Each song has a comment button and a ⋯ menu with play, add a comment, versions, share and More info (BPM, key, length, format).' },
    { for: 'all', text: 'Comments open from the player in a box that stays above your phone keyboard. Press Send/Enter to post.' },
    { for: 'engineer', text: 'Deliver new versions and Add a demo now live in the ⋯ menu, on the tracklist and on the song page.' },
  ] },
  { id: 'client-mobile-simple', date: '2026-10-28', title: 'A simpler client view on phones', items: [
    { for: 'client', text: 'On your phone, projects and songs show just what you need: the cover, play, your songs and versions, notes, and approve.' },
  ] },
  { id: 'cover-click', date: '2026-10-28', title: 'Click the cover to change it', items: [
    { for: 'engineer', text: 'The Shuffle and Upload image buttons are gone from the cover. Click the cover art for a small menu: upload new, shuffle, or remove.' },
    { for: 'all', text: 'On phones, covers stay still. Only the round mini player cover spins.' },
  ] },
  { id: 'desk-tidy', date: '2026-10-28', title: 'Record, renaming and deleting', items: [
    { for: 'all', text: 'On the computer the record now slides out to the left of the cover, away from the title.' },
    { for: 'engineer', text: 'Renaming a title or song keeps the same text size while you type.' },
    { for: 'engineer', text: 'Deleting a project from the sidebar just asks once. Press Enter or OK, no typing DELETE.' },
  ] },
  { id: 'mobile-player-swipe', date: '2026-10-28', title: 'Phone player: swipe down, less spinning', items: [
    { for: 'all', text: 'Swipe down on the full player to close it, no need to reach the button at the top.' },
    { for: 'all', text: 'On phones only the small round mini player spins while it plays. The big cover stays still and square.' },
    { for: 'all', text: 'A tidier mini player on phones that sits neatly above the tabs, and the More menu no longer lists projects.' },
  ] },
  {
    id: '2026-10-28-mobile-clean',
    date: '2026-10-28',
    title: 'Cleaner on phones',
    items: [
      { for: 'all', text: 'Pages use the full width of your phone again.' },
      { for: 'all', text: 'Swipe through your projects on Home.' },
      { for: 'all', text: 'A simple ‹ Back button up top instead of the long path.' },
      { for: 'all', text: 'Song pages on phones are simpler, with a still cover and just the essentials.' },
    ],
  },
  {
    id: '2026-10-28-fix-missing',
    date: '2026-10-28',
    title: 'Fixed: songs not showing',
    items: [
      { for: 'all', text: 'Projects and songs that seemed to disappear are back. They were never deleted, the app just couldn’t load them.' },
    ],
  },
  {
    id: '2026-10-28-ctxmenu',
    date: '2026-10-28',
    title: 'Right-click projects',
    items: [
      { for: 'engineer', text: 'Right-click a project in the sidebar to open, archive or delete it. Archived projects sit in their own list where you can restore them.' },
    ],
  },
  {
    id: '2026-10-28-engineers',
    date: '2026-10-28',
    title: 'Add an engineer',
    items: [
      { for: 'engineer', text: 'Add an assistant or co-engineer in Security › Engineers. They get full engineer access.' },
      { for: 'client', text: 'The Portal now says “Send your files”.' },
    ],
  },
  {
    id: '2026-10-28-speed',
    date: '2026-10-28',
    title: 'Smoother and quicker',
    items: [
      { for: 'all', text: 'The sign-in covers move more smoothly, load faster, and fill the whole screen on phones.' },
    ],
  },
  {
    id: '2026-10-28-enter',
    date: '2026-10-28',
    title: 'Come on in',
    items: [
      { for: 'all', text: 'Loading shows the CTRL ROOM logo filling up from left to right as your projects come in.' },
      { for: 'all', text: 'The arthouse wordmark sits at the very bottom of every page.' },
    ],
  },
  {
    id: '2026-10-28-drift',
    date: '2026-10-28',
    title: 'A sign-in page with some life',
    items: [
      { for: 'all', text: 'Album covers drift slowly left and right behind the sign-in page, like film strips. Tap one to open it on Apple Music.' },
      { for: 'engineer', text: 'Pick the playlist in Security › Sign-in page covers.' },
    ],
  },
  {
    id: '2026-10-28-mobile-tabs',
    date: '2026-10-28',
    title: 'Better on your phone',
    items: [
      { for: 'all', text: 'Tabs along the bottom on phones, plus More for everything else: your projects, What’s new, Security, and Sign out.' },
      { for: 'all', text: 'Tidier phone layout: fields don’t zoom in when you tap them, buttons are bigger, and the player sits neatly above the tabs.' },
    ],
  },
  {
    id: '2026-10-28-columns',
    date: '2026-10-28',
    title: 'Choose your columns',
    items: [
      { for: 'all', text: 'Pick what the tracklist shows with the Columns menu: Version, Length, Format, BPM and Key by default. It’s saved to your account.' },
      { for: 'engineer', text: 'Move songs up and down with the arrows on each row, or drag them. Artist admins can too.' },
      { for: 'all', text: 'Song pages list versions the same clean way as projects.' },
    ],
  },
  {
    id: '2026-10-28-mobile-player',
    date: '2026-10-28',
    title: 'A phone player that feels like Apple Music',
    items: [
      { for: 'all', text: 'On your phone, Now Playing opens full screen with a still cover, big controls, time left, and 15-second skips.' },
      { for: 'all', text: 'Tap the comment button to leave a note pinned to the exact moment you’re hearing.' },
      { for: 'client', text: 'The Portal is simpler: just drop your files. The song name, BPM and key come from your reference track.' },
    ],
  },
  {
    id: '2026-10-28-cal-projects',
    date: '2026-10-28',
    title: 'Projects on the calendar, Nerd stuff, prep guide',
    items: [
      { for: 'engineer', text: 'Drag a project from the tray under the calendar onto a day to set when it’s due. Drag it back to clear the date. It shows in Apple or Google Calendar too.' },
      { for: 'engineer', text: 'Projects show just songs and total time up top. Loudness spread, peaks, formats, tempo and keys live under “Nerd stuff” at the bottom.' },
      { for: 'client', text: '“How to prep your files” on the Portal opens a step-by-step guide in its own tab.' },
    ],
  },
  {
    id: '2026-10-28-admins',
    date: '2026-10-28',
    title: 'Artist admins and the active version',
    items: [
      { for: 'engineer', text: 'Make anyone on an artist’s Team an Admin. They can change cover art, track order, titles and the active version.' },
      { for: 'all', text: 'Drag songs to reorder a project’s tracklist (engineer and admins).' },
      { for: 'all', text: 'Pick the active version of a song in its version stack (⋯ › Make active version). It’s what plays first and what share links use.' },
    ],
  },
  {
    id: '2026-10-28-comments',
    date: '2026-10-28',
    title: 'Comments you can talk back to',
    items: [
      { for: 'all', text: 'Reply to any comment, and react with 🔥 ❤️ 👏 and more.' },
      { for: 'all', text: 'Comments can cover a stretch of the song, like 0:35 – 0:52. Tap a time to jump there.' },
      { for: 'all', text: 'Everyone on the project, including the artist’s team, can comment and react.' },
      { for: 'engineer', text: 'Turn on “Comments on the link” in Share so people with a share link can comment too. It’s off by default.' },
    ],
  },
  {
    id: '2026-10-28-stacks',
    date: '2026-10-28',
    title: 'Version stacks',
    items: [
      { for: 'all', text: 'Tap the stack icon on any song in a project to see all its versions right there. Each one shows its notes count, and you can click to play it.' },
      { for: 'engineer', text: 'Hover a version’s name or its v-number and click to rename it. + Add Version and Delete are right in the stack.' },
    ],
  },
  {
    id: '2026-10-28-invoices',
    date: '2026-10-28',
    title: 'Invoices',
    items: [
      { for: 'engineer', text: 'Attach an Invoice2go (or any) invoice to a project. It stays private until you switch on “Show to client”, and “Let them know” texts them the link.' },
      { for: 'engineer', text: '“Lock until paid” pauses the client’s listening and share links until the invoice is marked paid. You can mark it paid by hand, or automatically with Zapier.' },
      { for: 'engineer', text: 'Unpaid invoices show on Home with the total.' },
      { for: 'client', text: 'When your engineer shares an invoice, you’ll see it on your project with a View & pay button.' },
    ],
  },
  {
    id: '2026-10-28-lossless',
    date: '2026-10-28',
    title: 'Lossless and Hi-Res Lossless',
    items: [
      { for: 'all', text: 'Mixes delivered as WAV, AIFF or FLAC show a Lossless badge. Above 48 kHz they show Hi-Res Lossless, with the exact bit depth and sample rate in the player.' },
      { for: 'all', text: 'You’ll see the badge in the mini player, Now Playing, the song page, the version list and share links.' },
      { for: 'engineer', text: 'The tracklist’s format column shows Lossless, Hi-Res or MP3 at a glance, and you get a heads-up when you deliver a compressed file.' },
    ],
  },
  {
    id: '2026-10-28-insights',
    date: '2026-10-28',
    title: 'Insights and leak alerts',
    items: [
      { for: 'engineer', text: 'Insights: your latest listen, plays this week for each song, and quick totals.' },
      { for: 'engineer', text: 'Leak alerts: a sudden run of plays, a listen from a new place, or a link spreading too far gets flagged, with a text to you right away. Shut the link down or reset it in one tap.' },
      { for: 'all', text: 'A new page explains how CTRL ROOM protects your music. It’s linked from sign-in.' },
    ],
  },
  {
    id: '2026-10-28-quick-edits',
    date: '2026-10-28',
    title: 'Quicker edits on the song page',
    items: [
      { for: 'engineer', text: 'The version picker sits on the waveform. Hover a version name and click to rename it (v2.1, Demo and so on).' },
      { for: 'engineer', text: 'BPM and key are at the top of the song. Click to fix them.' },
      { for: 'engineer', text: 'The listen map moved to the Listening tab, with one for each version.' },
    ],
  },
  {
    id: '2026-10-28-security',
    date: '2026-10-28',
    title: 'Security and automatic measuring',
    items: [
      { for: 'all', text: 'Two-step verification: turn it on in Security (under your email in the sidebar) to need a code from your authenticator app when you sign in.' },
      { for: 'client', text: 'New accounts confirm their email once before projects unlock, so no one can sign up as you.' },
      { for: 'engineer', text: 'Confirm a client yourself from the artist’s Team list.' },
      { for: 'engineer', text: 'LUFS, peak, format, BPM and key are measured by themselves when mixes go up. Older mixes get measured in the background when you open the project.' },
      { for: 'engineer', text: 'A daily check of the database, music storage, Dropbox and texting, with a text to you if something breaks.' },
      { for: 'all', text: 'Tighter protection: shorter play links, request limits, and browser security headers.' },
      { for: 'all', text: 'A/B is replaced by a version dropdown by the waveform. Every version shows its own little waveform so you can see the differences. Switching keeps your spot, and X jumps back.' },
    ],
  },
  {
    id: '2026-10-28-demo',
    date: '2026-10-28',
    title: 'Compare every mix to the demo',
    items: [
      { for: 'all', text: 'Songs can have a Demo: the starting point, shown before v1 on the timeline.' },
      { for: 'all', text: 'A/B starts as Demo vs the latest mix. “Compare to demo” sets it up any time, and X flips between them.' },
      { for: 'all', text: 'Add a demo from the song page with + Add demo.' },
      { for: 'client', text: 'Send a rough mix through the Portal and it becomes the song’s demo by itself.' },
      { for: 'engineer', text: 'A demo never counts as the latest mix, never asks for approval, and doesn’t change the v1, v2 numbering.' },
    ],
  },
  {
    id: '2026-10-28-art',
    date: '2026-10-28',
    title: 'Artwork that matches everywhere',
    items: [
      { for: 'all', text: 'Songs use their project’s cover everywhere: lists, the song page, the mini player, Now Playing and share links.' },
      { for: 'all', text: 'Change a cover and the player updates right away.' },
      { for: 'engineer', text: 'Want one song to look different? Shuffle or upload on that song’s cover. “Use project cover” switches it back.' },
    ],
  },
  {
    id: '2026-10-28-calendar',
    date: '2026-10-28',
    title: 'Calendar',
    items: [
      { for: 'engineer', text: 'A Calendar page with every song’s due date and every release. Drag a song to another day to move it.' },
      { for: 'engineer', text: '“Add to my calendar” puts due dates in Apple Calendar or Google Calendar, with a reminder the evening before, and keeps them updated.' },
      { for: 'engineer', text: 'Deliver several versions at once from a song page: pick or drop multiple files.' },
    ],
  },
  {
    id: '2026-10-28-portal-smart',
    date: '2026-10-28',
    title: 'The Portal fills itself in',
    items: [
      { for: 'client', text: 'Paste your Spotify artist link and your artist name, photo and bio come in for you.' },
      { for: 'client', text: 'Drop your files and the song name, BPM and key fill in by themselves. They’re read from the file names or detected from the audio, and you can change them.' },
      { for: 'client', text: 'Each song shows what you sent, like “14 stems · 2 vocals · rough mix”.' },
      { for: 'client', text: 'Add a “Need it by” date so your engineer knows your deadline.' },
      { for: 'client', text: 'Drop files anywhere on the Portal. Each folder becomes a song, and you get a little hype while you drag.' },
      { for: 'engineer', text: 'Deadlines from the Portal become each song’s due date on Home.' },
      { for: 'engineer', text: 'Portal inbox has an Archive, and client files now land in one Dropbox folder per artist.' },
    ],
  },
  {
    id: '2026-10-28-portal-simple',
    date: '2026-10-28',
    title: 'A simpler Portal',
    items: [
      { for: 'client', text: 'Starting a mix is quicker: just you and your songs. No project details to fill in.' },
      { for: 'client', text: 'Send up to 2 GB per upload. Big files go up in pieces and come out whole on the other side.' },
      { for: 'engineer', text: 'Portal projects are named for you (the song for a single, “Artist – 4 songs” for more). Rename them on the project page.' },
      { for: 'engineer', text: 'Dropbox now spots business team folders by itself and tells you if the Dropbox app needs Full Dropbox access.' },
    ],
  },
  {
    id: '2026-10-28-mac',
    date: '2026-10-28',
    title: 'CTRL ROOM for Mac, Dropbox, and a Portal domain',
    items: [
      { for: 'engineer', text: 'A real Mac app: drop mixes on the Dock icon, right-click a bounce › Open With › CTRL ROOM, or press ⌘U. Music keeps playing when you close the window. Get it from the sidebar.' },
      { for: 'engineer', text: 'Connect Dropbox with one button and pick the folder client files go into.' },
      { for: 'engineer', text: 'Dropbox Business works too: pick your business account when you connect, and use the shared team folders.' },
      { for: 'engineer', text: 'The Portal can live on its own domain, like sendfileshere.com.' },
    ],
  },
  {
    id: '2026-10-28-columns-teams',
    date: '2026-10-28',
    title: 'Track details, artist teams, cleaner names',
    items: [
      { for: 'engineer', text: 'Project tracklists now have columns: version, length, LUFS, peak, format and sample rate, BPM and key, with total runtime and the LUFS spread across the project.' },
      { for: 'engineer', text: 'Every new mix gets its loudness measured (integrated LUFS, EBU R128). Tap Measure on a project to fill in older mixes.' },
      { for: 'engineer', text: 'Artist teams: add the artist, manager or producer by email on the artist page. Everyone on the team can open and add to that artist’s projects, and no one else can.' },
      { for: 'all', text: 'Song names made from file names no longer have dashes or track numbers in them.' },
      { for: 'client', text: 'Project tracklists show each song’s length. In the Portal you can add to any project you’re on the team for.' },
    ],
  },
  {
    id: '2026-10-28-signup',
    date: '2026-10-28',
    title: 'Create an account',
    items: [
      { for: 'all', text: 'New sign-up page: create an account with your email and a password. You’re in right away, with no email to wait for.' },
      { for: 'client', text: 'Your name, artist, phone and Spotify link fill in for you when you start a mix in the Portal.' },
    ],
  },
  {
    id: '2026-10-28-share-artists',
    date: '2026-10-28',
    title: 'Share links and artist pages',
    items: [
      { for: 'all', text: 'Share a song or a whole project with a link. Anyone can listen, no account needed, and notes and other versions stay private.' },
      { for: 'engineer', text: 'Switch sharing on or off per project or per song, and reset a link to make the old one stop working. Plays from share links show up in Activity.' },
      { for: 'all', text: 'Artist pages: paste a Spotify artist link to bring in the name, photo, header and listeners, then add a bio or your own images.' },
      { for: 'client', text: 'Find your artist page in the sidebar, or add your Spotify link when you start a mix in the Portal.' },
      { for: 'engineer', text: 'Rename a project right on its page (tap ✎ by the title), and rename songs straight from the tracklist.' },
    ],
  },
  {
    id: '2026-10-27-now-playing',
    date: '2026-10-27',
    title: 'A pop-up player',
    items: [
      { for: 'all', text: 'Tap the mini player to pop open Now Playing: the spinning record, waveform and controls, right above it.' },
      { for: 'all', text: 'Flip between versions right in the player. It keeps your spot. Press X to A/B.' },
      { for: 'all', text: 'See what’s up next and jump to any song. Close with ⌄, Esc, or a tap outside.' },
    ],
  },
  {
    id: '2026-10-27-whats-new',
    date: '2026-10-27',
    title: 'Update alerts and a What’s new page',
    items: [
      { for: 'all', text: 'A pop-up lets you know when there’s a new version of CTRL ROOM. Tap Update to get it.' },
      { for: 'all', text: 'This page: every update to CTRL ROOM, newest first.' },
    ],
  },
  {
    id: '2026-10-27-player',
    date: '2026-10-27',
    title: 'A player that follows you',
    items: [
      { for: 'all', text: 'Music keeps playing while you move around the app, with a mini player at the bottom.' },
      { for: 'all', text: 'Play songs straight from a project’s tracklist without opening them.' },
      { for: 'all', text: 'The space bar plays and pauses from anywhere.' },
      { for: 'engineer', text: 'Hover any cover to shuffle it, upload your own artwork, or remove it.' },
    ],
  },
  {
    id: '2026-10-27-quality',
    date: '2026-10-27',
    title: 'Original-quality playback',
    items: [
      { for: 'all', text: 'Every mix plays exactly as uploaded: no compression, no limiting, no volume changes.' },
      { for: 'all', text: 'Each version shows its real format, like WAV · 24-bit · 48 kHz.' },
      { for: 'engineer', text: 'Rename any song by tapping ✎ next to its title.' },
    ],
  },
  {
    id: '2026-10-27-filenames',
    date: '2026-10-27',
    title: 'Smart file names',
    items: [
      { for: 'engineer', text: 'Drop mixes on Home and projects, songs and versions are created from the file names (“Artist - Song - Mix 2.wav”).' },
      { for: 'engineer', text: '“Mix 3”, “v2.1”, “Rev 4” become version labels; Instrumental, Clean and Radio Edit go in the version note.' },
      { for: 'client', text: 'In the Portal, a song’s title fills in from your file name if you leave it blank.' },
    ],
  },
  {
    id: '2026-10-27-launch',
    date: '2026-10-27',
    title: 'CTRL ROOM is live',
    items: [
      { for: 'all', text: 'Listen to every version, flip between them with A/B, and leave timestamp or general notes.' },
      { for: 'client', text: 'Approve a mix or request changes right from the song page.' },
      { for: 'client', text: 'Start a mix and send your files through the Portal.' },
      { for: 'engineer', text: 'Home with what’s due this week, Artists, the Portal inbox, listen tracking and texts to clients.' },
    ],
  },
];

export const latestId = CHANGELOG[0]?.id;
export const forRole = (eng) => CHANGELOG
  .map((e) => ({ ...e, items: e.items.filter((i) => i.for === 'all' || i.for === (eng ? 'engineer' : 'client')) }))
  .filter((e) => e.items.length);
