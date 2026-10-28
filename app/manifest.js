export default function manifest() {
  return {
    name: 'CTRL ROOM',
    short_name: 'CTRL ROOM',
    description: 'Listen, leave notes, and approve your mixes.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0f0f10',
    theme_color: '#0f0f10',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
