// The "What's new" log. Newest first. Add an entry with every update.
// for: 'all' | 'engineer' | 'client' — who sees the item.
export const CHANGELOG = [
  { id: 'names-in-plays', date: '2026-10-29', title: 'Names on listens', items: [
    { for: 'engineer', text: 'Notifications and Activity show who listened by their display name (or “Someone on a share link”).' },
  ] },
  { id: 'player-tap-fix', date: '2026-10-29', title: 'Player buttons work again', items: [
    { for: 'all', text: 'Fixed the player’s Comment button (and other buttons) not responding: a see-through layer was sitting on top of the player.' },
  ] },
  { id: 'seal-kinds', date: '2026-10-29', title: 'Three kinds of verified', items: [
    { for: 'all', text: 'Yellow seal: verified artist. White seal: verified engineer. Gray seal: verified user. Hover a seal to see what it means.' },
  ] },
  { id: 'artist-verified', date: '2026-10-29', title: 'Verified artists', items: [
    { for: 'engineer', text: 'An artist is only Verified once the artist’s own email is verified: mark it as “Artist” on their Team list (or tick “The first email is the artist’s own” when adding them). Team members don’t count.' },
    { for: 'all', text: 'Verified artists and engineers get the yellow seal. Everyone else who’s verified gets a gray one.' },
  ] },
  { id: 'people-and-domain', date: '2026-10-29', title: 'People, your photo, and one address', items: [
    { for: 'all', text: 'CTRL ROOM always opens on ctrl-room.app now. The old Vercel address sends you there automatically.' },
    { for: 'all', text: 'Everyone can set a full name, display name and photo in Settings › Account.' },
    { for: 'engineer', text: 'New People page: everyone with an account, who they’re with, who’s not on an artist yet. Verify them or add them to an artist in one tap.' },
  ] },
  { id: 'tab-you', date: '2026-10-29', title: 'Your picture in the tab bar', items: [
    { for: 'all', text: 'On phones the last tab is your picture (“You”). Tap it for your card, Settings, the rest of the menu and Sign out.' },
  ] },
  { id: 'settings-tabs', date: '2026-10-29', title: 'Settings, in tabs', items: [
    { for: 'all', text: 'Click your name in the sidebar (or More on your phone) for Settings: Profile, Notifications and Security, each on its own tab.' },
    { for: 'engineer', text: 'A Studio tab holds the daily check, email invites, engineers and the login screen.' },
  ] },
  { id: 'imessage-preview', date: '2026-10-29', title: 'iMessage previews show the cover', items: [
    { for: 'all', text: 'Share link previews now use the cover art itself and read “Artist – Song” (or project).' },
  ] },
  { id: 'tap-fix', date: '2026-10-29', title: 'Phones stay responsive while playing', items: [
    { for: 'all', text: 'Fixed share links on phones not responding to taps after pressing play. The app player is lighter on phones too.' },
  ] },
  { id: 'side-me', date: '2026-10-29', title: 'You, in the sidebar', items: [
    { for: 'all', text: 'The bottom of the sidebar shows your picture, name, email and role, with Your profile, Security and Sign out lined up under it.' },
  ] },
  { id: 'notifications', date: '2026-10-29', title: 'Notifications', items: [
    { for: 'all', text: 'A bell at the top shows what’s new: listens, notes, approvals, new mixes and updates.' },
    { for: 'all', text: 'Pick what you hear about, in the app and by email, in Security › Notifications.' },
  ] },
  { id: 'note-box-v3', date: '2026-10-29', title: 'Better note box', items: [
    { for: 'all', text: 'Notes can be “At a moment” or a “General note”. Fix the time with −5s / +5s, Now, or tap it to type one.' },
    { for: 'all', text: 'Smoother on phones: the player makes room above the keyboard instead of jumping.' },
  ] },
  { id: 'share-popout', date: '2026-10-29', title: 'Share link player pops out', items: [
    { for: 'all', text: 'On share links, tap the mini player (or a song’s comment icon) and the full player pops out like in the app: big cover, waveform with comments, controls, a note box, and Notes / Progress / Details.' },
  ] },
  { id: 'comment-from-player', date: '2026-10-29', title: 'Comment from the player', items: [
    { for: 'all', text: 'On share links, tap the comment icon next to any song (or Comment under the waveform): the song plays and the mini player opens a note box at that moment. Works on phones and computers.' },
  ] },
  { id: 'mini-comment', date: '2026-10-29', title: 'Comment from the mini player', items: [
    { for: 'all', text: 'On phones, share link mini players have a comment button: leave a note at that exact moment without scrolling down.' },
  ] },
  { id: 'long-projects', date: '2026-10-29', title: 'Long projects on share links', items: [
    { for: 'all', text: 'On a computer the cover stays at the top next to the title. Projects with lots of songs show the first few (Show all to see the rest), so comments stay close.' },
  ] },
  { id: 'hover-play', date: '2026-10-29', title: 'Track numbers work like a player', items: [
    { for: 'all', text: 'Hover a song number to play it; the playing song shows a pause button. On share links and in the app.' },
    { for: 'all', text: 'Share links on a computer are roomier, with the CTRL ROOM logo in the top-left corner and Progress / Details centered.' },
  ] },
  { id: 'share-layout', date: '2026-10-29', title: 'Share link layout', items: [
    { for: 'all', text: 'On share links the song list sits right under the waveform, then comments, then Progress and Details.' },
  ] },
  { id: 'progress-details-v2', date: '2026-10-29', title: 'Better Progress and Details', items: [
    { for: 'all', text: 'Progress says where the song is at (“Ready for you to review”, step 3 of 4) with a 4-part bar and dated steps. Details is a clean list. Share link songs show a Final tag once approved.' },
  ] },
  { id: 'tabs-underline', date: '2026-10-29', title: 'Cleaner tabs', items: [
    { for: 'all', text: 'Tabs under the player are simple text tabs with a yellow underline on the one you’re on.' },
    { for: 'all', text: 'On phones, the share link mini player appears as soon as the cover scrolls away. Computers don’t show it.' },
  ] },
  { id: 'tabs-mini', date: '2026-10-29', title: 'Nicer tabs, mini player on share links', items: [
    { for: 'all', text: 'The tabs under the player are roomier, with a lit yellow tab for the one you’re on. “Up next” is now “Playlist”.' },
    { for: 'all', text: 'On share links, scroll down and a mini player sticks to the bottom with play / pause and next.' },
  ] },
  { id: 'share-tabs', date: '2026-10-29', title: 'Progress and details on share links', items: [
    { for: 'all', text: 'Share links have Songs, Progress and Details tabs under the player, like the app.' },
  ] },
  { id: 'ctrl-room-app-links', date: '2026-10-29', title: 'Links use ctrl-room.app', items: [
    { for: 'all', text: 'Share links, invites and emails always use ctrl-room.app now, never the old Vercel address.' },
  ] },
  { id: 'wave-comments', date: '2026-10-29', title: 'Comments on the waveform', items: [
    { for: 'all', text: 'Like SoundCloud: every note shows as a little dot under the waveform in the player, and as the song plays past it, the comment pops up. Tap a dot to jump there.' },
    { for: 'all', text: 'Share links on phones show the cover and a play button again.' },
  ] },
  { id: 'mobile-cover-pause', date: '2026-10-29', title: 'Phone fixes', items: [
    { for: 'all', text: 'The project cover always shows on phones, and the song that’s playing has a yellow pause / play button right in the list.' },
  ] },
  { id: 'player-deck', date: '2026-10-29', title: 'More in the player', items: [
    { for: 'all', text: 'At the bottom of the player: Up next, Notes (tap one to jump to that moment), Progress and Details (version, length, BPM, key, format).' },
    { for: 'all', text: 'The Comment button and note box are quieter and blend in.' },
  ] },
  { id: 'select-approve', date: '2026-10-29', title: 'Select songs: approve all at once', items: [
    { for: 'all', text: 'Tap Select above the songs, pick some (or Select all) and Approve them in one go.' },
    { for: 'engineer', text: 'Select also lets you delete several songs at once.' },
  ] },
  { id: 'panel-close', date: '2026-10-29', title: 'Easy to close', items: [
    { for: 'engineer', text: 'Windows from the + menu (Client access, Invoices, Edit details) have an ✕, and close when you click anywhere else or press Esc.' },
  ] },
  { id: 'drag-stack', date: '2026-10-29', title: 'Drag mixes in, stack versions', items: [
    { for: 'engineer', text: 'Drag mix files anywhere on a project and they go to the matching songs. Drop one right on a song and it becomes that song’s next version.' },
    { for: 'engineer', text: 'The + menu is simpler: “Add files / mixes” replaces Add a song (new songs are made from the file name).' },
  ] },
  { id: 'link-previews', date: '2026-10-29', title: 'Share links look good in messages', items: [
    { for: 'all', text: 'Share links show a preview card in iMessage, Instagram, WhatsApp and Slack: the cover art, song or project name, the artist and who mixed it.' },
    { for: 'engineer', text: 'The switches in Share (and Invoices) line up.' },
  ] },
  { id: 'add-mixes-straight-in', date: '2026-10-29', title: 'Add mixes goes straight in', items: [
    { for: 'engineer', text: '+ › Add mixes opens your files right away. Every file you pick goes straight into the project and the timeline updates on its own. Keep adding with “+ Add more”.' },
    { for: 'engineer', text: 'Emailing the client is a separate tap afterwards (“Email the client”), wherever you add mixes.' },
  ] },
  { id: 'case-addmixes', date: '2026-10-29', title: 'Title styles when adding mixes', items: [
    { for: 'engineer', text: 'Add mixes to an existing project and new song titles get the AA / Aa / A. / aa buttons (and “Style every new title”). Renaming a song from the tracklist has them too.' },
  ] },
  { id: 'email-updates', date: '2026-10-29', title: 'Updates by email', items: [
    { for: 'all', text: 'Mix-ready and progress updates now go out by email (to the project contact and the artist’s team), with a Listen button. Reply to reach your engineer.' },
    { for: 'engineer', text: 'Your alerts (new Portal files, sign-ups, paid invoices, unusual listening, the daily check) come by email too.' },
  ] },
  { id: 'lock-screen', date: '2026-10-29', title: 'Lock screen player', items: [
    { for: 'all', text: 'Lock your iPhone while listening and the lock screen shows the cover art, song, artist and version, with play, pause, skip and scrubbing. Works in Control Center, with AirPods and on share links too.' },
  ] },
  { id: 'share-icon', date: '2026-10-29', title: 'Cleaner share button', items: [
    { for: 'all', text: 'Share is now just the share icon, and project titles sit dead center on phones.' },
  ] },
  { id: 'centered-mobile', date: '2026-10-29', title: 'Centered on phones, artist under the title', items: [
    { for: 'all', text: 'On phones the project page is centered: cover, title, artist, details, credit, and the play / share / + buttons in one tidy row.' },
    { for: 'all', text: 'The artist’s name sits right under the project or song title.' },
  ] },
  { id: 'alignment', date: '2026-10-29', title: 'Everything lines up', items: [
    { for: 'all', text: 'Tidied spacing across the app: section headings, side-by-side columns, list rows and project cards all line up on phone and computer.' },
  ] },
  { id: 'no-type', date: '2026-10-29', title: 'Simpler project info', items: [
    { for: 'all', text: 'Projects just show how many songs and how many are approved. No more Single / EP / Album labels.' },
  ] },
  { id: 'artist-pics', date: '2026-10-29', title: 'Artist pictures by their names', items: [
    { for: 'all', text: 'Artist names show their little Spotify picture on projects, songs, the player and Home. Tap the name to open their artist page.' },
  ] },
  { id: 'notes-inline', date: '2026-10-29', title: 'Notes without covering the screen', items: [
    { for: 'all', text: 'Tap Comment in the player: the cover shrinks, the waveform moves up with a yellow pin at your spot, and the note box sits right under it.' },
    { for: 'all', text: 'Project covers sit centered on phones, and the “Mixed by” credit is a little smaller.' },
    { for: 'engineer', text: 'Artist names from Spotify come through exactly as Spotify has them.' },
  ] },
  { id: 'portal-receipt', date: '2026-10-29', title: 'Files received emails', items: [
    { for: 'all', text: 'After sending files through the Portal (sendfileshere.com), you get a “Files received ✓” email listing what came through. Reply to it to reach your engineer.' },
  ] },
  { id: 'credit-card', date: '2026-10-29', title: 'Get to know your engineer', items: [
    { for: 'all', text: 'Hover (or tap on your phone) “Mixed by …” to see the engineer’s photo, what they do, their bio and Instagram.' },
  ] },
  { id: 'yellow-seal', date: '2026-10-29', title: 'A cleaner verified seal', items: [
    { for: 'all', text: 'The verified check is a crisp rosette seal in CTRL ROOM yellow, the same everywhere it shows.' },
  ] },
  { id: 'waiting-grouped', date: '2026-10-29', title: 'Waiting on clients, by project', items: [
    { for: 'engineer', text: 'When several songs from one project are waiting on the client, Home shows the project once (“all 4 songs”) instead of every song.' },
  ] },
  { id: 'profile-photo', date: '2026-10-29', title: 'Profile pictures', items: [
    { for: 'engineer', text: 'Upload a profile picture on Your profile (tap your circle), or type your Instagram username to use your Instagram picture.' },
  ] },
  { id: 'engineer-profiles', date: '2026-10-29', title: 'Engineer profiles and credits', items: [
    { for: 'engineer', text: 'Set up Your profile (sidebar, or More on your phone): full name, display name and what you do. Projects show “Mixed & mastered by …”, with a blue check once your email is verified.' },
    { for: 'engineer', text: 'Pick which engineer is credited on a project in Edit details.' },
    { for: 'all', text: 'Projects, songs, the player and share links show who mixed them.' },
  ] },
  { id: 'spotify-wins', date: '2026-10-29', title: 'Spotify sets the artist name and bio', items: [
    { for: 'engineer', text: 'Pull from Spotify now renames the artist everywhere to their Spotify name (projects, team, Portal), and fills in the Spotify bio.' },
    { for: 'all', text: 'The record’s tone arm is gone from song pages.' },
  ] },
  { id: 'invite-only-engineers', date: '2026-10-29', title: 'Engineers are invite-only', items: [
    { for: 'engineer', text: 'Sign up is for artists and their teams only. Engineer access only comes from Security › Engineers, which now emails them an invite.' },
  ] },
  { id: 'deadline-signups', date: '2026-10-29', title: 'Final deadlines and sign-up alerts', items: [
    { for: 'engineer', text: 'Give a project a final deadline: tap “Add a final deadline” under its title (or in Edit details / New project). It counts down, turns yellow close to the date and red when late.' },
    { for: 'engineer', text: 'You get an email (and a text, if texting is set up) when someone signs up or accepts an invite.' },
  ] },
  { id: 'smooth-notes', date: '2026-10-29', title: 'Smoother notes on phones', items: [
    { for: 'all', text: 'Adding a note is a small bar that slides up above the keyboard: the time on the left (tap it to set it to now), your note, and a send button. The player stays in view.' },
  ] },
  { id: 'plus-folders', date: '2026-10-29', title: 'One + for everything, and folders', items: [
    { for: 'engineer', text: 'A + next to Projects in the sidebar makes a new project or a new folder. Name folders, drag projects into them, or right-click a project › Move to folder.' },
    { for: 'engineer', text: 'On a project, one + button holds Add mixes, Add a song, Client access, Invoices and Edit details, so the page stays clean.' },
  ] },
  { id: 'mfa-layout', date: '2026-10-29', title: 'Cleaner two-step check on phones', items: [
    { for: 'all', text: 'The two-step code screen is one tidy column: a big code box, Remember this device, and a full-width Continue button.' },
  ] },
  { id: 'title-style-artist-pick', date: '2026-10-29', title: 'Pick the artist, style the title', items: [
    { for: 'engineer', text: 'New project, Edit details and the upload drop box let you pick an artist you already have, or “+ New artist…”.' },
    { for: 'engineer', text: 'Title boxes have AA / Aa / A. / aa buttons: ALL CAPS, Title Case, first letter only, or lowercase. Drops can style every title at once.' },
    { for: 'all', text: 'Song and project titles now show exactly as they’re written, instead of always in capitals.' },
  ] },
  { id: 'remember-device', date: '2026-10-29', title: 'Remember this device', items: [
    { for: 'all', text: 'Tick “Remember this device” on the two-step check and that browser or the Mac app skips the code for 30 days. Forget them all under Security.' },
  ] },
  { id: 'invites-own-email', date: '2026-10-28', title: 'Invites that actually arrive, and delete artist', items: [
    { for: 'engineer', text: 'Invites now go out as a CTRL ROOM email of their own (set up under Security › Email invites). Until then, every invite gives you a link to copy, and you can add a phone number to text it.' },
    { for: 'engineer', text: 'Send invite again from any artist’s Team list.' },
    { for: 'engineer', text: 'Delete an artist from the bottom of their page. Keep their projects archived, or delete everything.' },
  ] },
  { id: 'verify-downloads-receipts', date: '2026-10-28', title: 'Verify people, downloads switch, receipts', items: [
    { for: 'engineer', text: 'Verify anyone yourself: “Mark them verified” when adding an artist, or tap Verify next to anyone on a team. No account yet? They get an invite email too.' },
    { for: 'engineer', text: '“Full access” gives a team everything (listen, comment, approve, cover, order, titles) except downloads. Switch on Allow downloads per project under Client access.' },
    { for: 'all', text: 'Artist pages pull the bio from Spotify more reliably, and from Wikipedia when Spotify has none.' },
    { for: 'engineer', text: 'Invoices show Pending payment or Paid. Once paid, upload the PDF receipt and the client can open it from the project.' },
    { for: 'client', text: 'Paid invoices show a Receipt (PDF) button for your records.' },
  ] },
  { id: 'verified-badges', date: '2026-10-28', title: 'Verified badges', items: [
    { for: 'engineer', text: 'Artists and team members show a blue ✓ Verified badge once they’ve signed up with their email and confirmed it. You can also see who’s been invited but hasn’t joined yet.' },
    { for: 'client', text: 'Your account shows ✓ Verified once your email is confirmed.' },
    { for: 'engineer', text: 'Fixed “Only engineers can add artists” showing up for engineers.' },
  ] },
  { id: 'add-artist-invite', date: '2026-10-28', title: 'Add artists and invite them', items: [
    { for: 'engineer', text: 'On Artists, tap “+ Add artist”: type the name and their email, and CTRL ROOM adds them and emails an invite to join.' },
    { for: 'client', text: 'Invited? Open the email, set your name and password, and you’re in.' },
  ] },
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
