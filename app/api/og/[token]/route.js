// Old preview address (links already sent point here): same picture as /og/<key>.
import { GET as og } from '@/app/og/[key]/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = (req, { params }) => og(req, { params: { key: params.token } });
