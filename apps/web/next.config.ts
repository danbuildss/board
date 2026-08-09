import type { NextConfig } from 'next';

const config: NextConfig = {
  // Required for pg in serverless
  serverExternalPackages: ['pg'],
};

export default config;
