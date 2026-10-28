// The "What's new" log. Newest first. Add an entry with every update.
// for: 'all' | 'engineer' | 'client' — who sees the item.
export const CHANGELOG = [
  {
    id: '2026-10-27-whats-new',
    date: '2026-10-27',
    title: 'Update alerts and a What’s new page',
    items: [
      { for: 'all', text: 'A pop-up lets you know when there’s a new version of Ctrl Room. Tap Update to get it.' },
      { for: 'all', text: 'This page: every update to Ctrl Room, newest first.' },
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
    title: 'Ctrl Room is live',
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
