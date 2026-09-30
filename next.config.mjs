/** @type {import('next').NextConfig} */
const allowedDevOrigins = [
  "192.168.0.53",
  "192.168.0.53:3000",
];

if (process.env.BETTER_AUTH_TRUSTED_ORIGINS) {
  for (const origin of process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(",")) {
    const trimmed = origin.trim();
    if (trimmed) {
      try {
        const parsed = new URL(trimmed);
        allowedDevOrigins.push(parsed.hostname);
        if (parsed.port) {
          allowedDevOrigins.push(`${parsed.hostname}:${parsed.port}`);
        }
      } catch {
        allowedDevOrigins.push(trimmed);
      }
    }
  }
}

const nextConfig = {
  // App Router je výchozí v Next.js 16+
  reactStrictMode: true,
  allowedDevOrigins: Array.from(new Set(allowedDevOrigins)),
};

export default nextConfig;
