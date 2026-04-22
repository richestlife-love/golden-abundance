/// <reference types="vitest" />
import { defineConfig, loadEnv, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import { sentryVitePlugin } from "@sentry/vite-plugin";

const DEFAULT_PORT = 5173;
const DEFAULT_API_BASE_URL = "http://localhost:8000";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const port = Number(env.VITE_PORT) || DEFAULT_PORT;
  const allowedHosts = env.VITE_ALLOWED_HOSTS
    ? env.VITE_ALLOWED_HOSTS.split(",")
        .map((h) => h.trim())
        .filter(Boolean)
    : [];

  const plugins: PluginOption[] = [react()];
  if (env.SENTRY_AUTH_TOKEN && env.VITE_RELEASE) {
    plugins.push(
      sentryVitePlugin({
        authToken: env.SENTRY_AUTH_TOKEN,
        org: env.SENTRY_ORG ?? "jinfuyou",
        project: env.SENTRY_PROJECT ?? "jinfuyou-frontend",
        release: { name: env.VITE_RELEASE },
        sourcemaps: { assets: "./dist/**" },
      }),
    );
  }

  return {
    plugins,
    build: {
      // "hidden" emits .map files so the Sentry plugin can upload them, but
      // doesn't add a `//# sourceMappingURL=` comment to the bundle — real
      // visitors don't fetch source maps; only Sentry resolves stack traces.
      sourcemap: "hidden",
      rolldownOptions: {
        output: {
          // Split heavy third-party libs into their own chunks so the main
          // app chunk stays under rolldown's 500 kB warning threshold and
          // vendor code can cache independently across app deploys.
          codeSplitting: {
            groups: [
              { name: "react", test: /node_modules\/(?:react|react-dom|scheduler)\// },
              { name: "sentry", test: /node_modules\/@sentry\// },
              { name: "tanstack", test: /node_modules\/@tanstack\// },
              { name: "supabase", test: /node_modules\/@supabase\// },
            ],
          },
        },
      },
    },
    server: {
      port,
      host: true,
      allowedHosts,
      proxy: {
        "/api": {
          target: env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL,
          changeOrigin: true,
        },
      },
    },
    preview: { port },
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: ["./src/test/setup-pre.ts", "./src/test/setup.ts"],
      css: false,
    },
  };
});
