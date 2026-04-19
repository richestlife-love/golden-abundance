import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    allowedHosts: ["subvitalized-occupative-katelyn.ngrok-free.dev"],
  },
  preview: { port: 5173 },
});
