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
