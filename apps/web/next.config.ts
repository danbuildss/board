import type { NextConfig } from 'next';

const config: NextConfig = {
  serverExternalPackages: ['pg'],
  async redirects() {
    return [
      { source: '/hood', destination: '/board/genesis', permanent: false },
      { source: '/boardroom/hood', destination: '/boardroom/genesis', permanent: false },
    ];
  },
};

export default config;
