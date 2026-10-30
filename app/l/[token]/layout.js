import { previewMeta } from '@/lib/previewmeta';

export const dynamic = 'force-dynamic';

// Link previews for share links: the cover art big, with the song / project name.
export async function generateMetadata({ params }) { return previewMeta(params.token, `/l/${params.token}`); }

export default function ShareLayout({ children }) { return children; }
