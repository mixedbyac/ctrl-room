/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  env: { NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA || 'dev' },
  async redirects() {
    // the Mac app's download link (built by GitHub Actions from /mac)
    return [{ source: '/mac', destination: 'https://github.com/mixedbyac/ctrl-room/releases/download/mac-app/CTRL-ROOM.dmg', permanent: false }];
  },
};

export default nextConfig;
