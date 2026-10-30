import { previewMeta } from '@/lib/previewmeta';

export const dynamic = 'force-dynamic';

// Project links from the app preview with their cover art and name too (opening one still needs sign-in).
export async function generateMetadata({ params }) { return previewMeta(`p_${params.id}`, `/p/${params.id}`); }

export default function ProjectLayout({ children }) { return children; }
