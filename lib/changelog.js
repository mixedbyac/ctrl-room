// The "What's new" log. Newest first. Add an entry with every update.
// for: 'all' | 'engineer' | 'client' — who sees the item.
export const CHANGELOG = [
  {
    id: '2026-10-28-portal-simple',
    date: '2026-10-28',
    title: 'A simpler Portal',
    items: [
      { for: 'client', text: 'Starting a mix is quicker: just you and your songs. No project details to fill in.' },
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
