import { previewMeta } from '@/lib/previewmeta';

export const dynamic = 'force-dynamic';

// Song links from the app preview with their cover art and name too (opening one still needs sign-in).
export async function generateMetadata({ params }) { return previewMeta(`s_${params.id}`, `/s/${params.id}`); }

export default function SongLayout({ children }) { return children; }
