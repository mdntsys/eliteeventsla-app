import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @react-pdf/renderer ships ESM + native-ish deps; keep it external to the
  // server bundle so it loads as a Node module at runtime (server-side PDF
  // generation for client invoices).
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;
