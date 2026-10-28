export const dynamic = 'force-dynamic';

// Which build is live right now. Open tabs compare this to their own build to know an update is out.
export function GET() {
  return Response.json(
    { build: process.env.VERCEL_GIT_COMMIT_SHA || process.env.BUILD_ID || 'dev' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
