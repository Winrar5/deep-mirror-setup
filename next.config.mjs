/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (cfg, { isServer }) => {
    if (isServer) cfg.externals.push('pdf-parse');
    return cfg;
  },
};
export default nextConfig;
