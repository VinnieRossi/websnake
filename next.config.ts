/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable Edge runtime for API routes
  experimental: {
    serverExternalPackages: ["socket.io", "bufferutil", "utf-8-validate"],
  },
  // Socket.IO needs WebSockets support
  webpack: (config: { externals: any[] }) => {
    config.externals.push({
      bufferutil: "bufferutil",
      "utf-8-validate": "utf-8-validate",
    });
    return config;
  },
};

export default nextConfig;
