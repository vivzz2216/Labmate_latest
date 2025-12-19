/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // Enable standalone output for Docker
  // images: {
  //   unoptimized: true, // Required for static export
  //   formats: ['image/avif', 'image/webp'],
  // },
  // trailingSlash: true, // Better for static hosting
  // compress: true, // Enable gzip compression
  // poweredByHeader: false, // Remove X-Powered-By header
  // generateEtags: true, // Enable ETags for caching
  // // Remove rewrites for static export (API calls will be direct)
  
  // // Note: Headers should be configured at the server/CDN level for static export
  // // Recommended headers:
  // // - X-Frame-Options: SAMEORIGIN
  // // - X-Content-Type-Options: nosniff
  // // - Referrer-Policy: origin-when-cross-origin
  // // - Cache-Control: public, max-age=31536000, immutable (for /_next/static/)
  
  env: {
    NEXT_PUBLIC_FIREBASE_CONFIG: process.env.NEXT_PUBLIC_FIREBASE_CONFIG || '',
  },

  // Railway-friendly: avoid browser CORS by proxying same-origin requests to the backend.
  // Frontend code should call `/api/...` and `/uploads/...` etc; Next will forward to backend.
  async rewrites() {
    const raw =
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.BACKEND_URL ||
      'http://localhost:8000'

    // Make the value robust to common misconfig:
    // - allow "labmatelatest-production.up.railway.app" (we'll prefix https://)
    // - strip trailing slashes
    const backend = (() => {
      const v = String(raw || '').trim().replace(/\/+$/, '')
      if (!v) return 'http://localhost:8000'
      if (v.startsWith('http://') || v.startsWith('https://')) return v
      return `https://${v}`
    })()

    return [
      { source: '/api/:path*', destination: `${backend}/api/:path*` },
      { source: '/uploads/:path*', destination: `${backend}/uploads/:path*` },
      { source: '/screenshots/:path*', destination: `${backend}/screenshots/:path*` },
      { source: '/reports/:path*', destination: `${backend}/reports/:path*` },
      { source: '/public/:path*', destination: `${backend}/public/:path*` },
    ]
  },
  
  webpack: (config, { isServer }) => {
    // Handle Node.js modules that face-api.js tries to use
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        encoding: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  },
}

module.exports = nextConfig
