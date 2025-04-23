/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable Edge runtime for API routes
  experimental: {
    serverComponentsExternalPackages: ['socket.io', 'bufferutil', 'utf-8-validate'],
  },
  // Socket.IO needs WebSockets support
  webpack: (config) => {
    config.externals.push({
      'bufferutil': 'bufferutil',
      'utf-8-validate': 'utf-8-validate',
    });
    return config;
  },
};

export default nextConfig;