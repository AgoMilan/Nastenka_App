/** @type {import('next').NextConfig} */
const allowedDevOrigins = [
  "192.168.0.53",
  "192.168.0.53:3000",
];

function addOrigin(originStr) {
  const trimmed = originStr?.trim();
  if (!trimmed) return;
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

if (process.env.BETTER_AUTH_URL) {
  addOrigin(process.env.BETTER_AUTH_URL);
}

if (process.env.BETTER_AUTH_TRUSTED_ORIGINS) {
  for (const origin of process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(",")) {
    addOrigin(origin);
  }
}

const nextConfig = {
  // App Router je výchozí v Next.js 16+
  reactStrictMode: true,
  allowedDevOrigins: Array.from(new Set(allowedDevOrigins)),
};

export default nextConfig;
