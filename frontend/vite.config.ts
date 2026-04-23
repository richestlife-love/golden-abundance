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

  if (env.VERCEL_ENV === "production" && !(env.SENTRY_AUTH_TOKEN && env.VITE_RELEASE)) {
    throw new Error(
      "Prod build requires SENTRY_AUTH_TOKEN and VITE_RELEASE. Without them the Sentry plugin is skipped and .map files ship to visitors.",
    );
  }

  const plugins: PluginOption[] = [react()];
  if (env.SENTRY_AUTH_TOKEN && env.VITE_RELEASE) {
    plugins.push(
      sentryVitePlugin({
        authToken: env.SENTRY_AUTH_TOKEN,
        org: env.SENTRY_ORG ?? "goldenabundance",
        project: env.SENTRY_PROJECT ?? "goldenabundance-frontend",
        release: { name: env.VITE_RELEASE },
        sourcemaps: {
          // Scope to JS + maps only — scanning the full dist tree (fonts,
          // images, HTML) is what pushed sentry-vite-plugin to ~60% of
          // build time.
          assets: ["./dist/**/*.js", "./dist/**/*.js.map"],
          // Delete both .js.map and .css.map — Vite emits CSS maps too with
          // `sourcemap: true`, and we don't want them served to visitors.
          filesToDeleteAfterUpload: "./dist/**/*.map",
        },
      }),
    );
  }

  return {
    plugins,
    build: {
      // 'hidden' emits .map files without the `//# sourceMappingURL=`
      // comment, so devtools doesn't 404 on them. The Sentry plugin
      // uploads via its explicit assets glob (debug IDs match JS↔map)
      // then deletes the maps from dist before Vercel uploads.
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
