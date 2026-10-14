import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Ignora los errores de TypeScript durante la compilación en Render
    ignoreBuildErrors: true,
  },
  eslint: {
    // Ignora advertencias y errores de ESLint durante el build
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
