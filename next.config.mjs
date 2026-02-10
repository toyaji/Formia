/** @type {import('next').NextConfig} */
const nextConfig = {
  // Tauri 빌드 시: NEXT_OUTPUT=export npm run build
  // 웹 개발/배포 시: npm run build (서버 모드, API Routes 활성화)
  ...(process.env.NEXT_OUTPUT === 'export'
    ? {
        output: 'export',
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
