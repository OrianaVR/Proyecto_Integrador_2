import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Ignora los errores de TypeScript durante la compilación en Render
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
