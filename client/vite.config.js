import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // The third parameter '' loads all env vars regardless of the VITE_ prefix.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api": {
          // Use the env variable here
          target: env.VITE_API_BASE_URL ,
          changeOrigin: true,
        },
        "/socket.io": {
          target: env.VITE_API_BASE_URL ,
          ws: true,
          changeOrigin: true,
        },
      },
    },
  };
});