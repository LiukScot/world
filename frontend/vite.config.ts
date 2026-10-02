import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The device build has no server to send a Content-Security-Policy header.
// 'wasm-unsafe-eval' lets SQLite's WebAssembly module compile.
const deviceCsp =
  "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; object-src 'none'";

const deviceCspPlugin: Plugin = {
  name: "device-csp",
  transformIndexHtml: () => [
    { tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: deviceCsp }, injectTo: "head-prepend" },
  ],
};

// `vite build --mode device` produces the build that carries its own backend:
// the API runs in the page on a SQLite database kept in the browser.
export default defineConfig(({ mode }) => ({
  plugins: [tailwindcss(), react(), ...(mode === "device" ? [deviceCspPlugin] : [])],
  optimizeDeps: {
    // Only the statement import reaches for it, and only through a dynamic
    // import, so the dev server does not see it while it prepares dependencies
    // at startup. Discovering it on the first click means re-bundling mid
    // request, which answers that request with a 504 and fails the import.
    include: ["pdfjs-dist"],
  },
  build: {
    // Sections, the wellbeing chart, and the emoji-heavy memorable-days view are
    // already React.lazy-split; the only chunk over 500 kB is memorable-days,
    // whose bulk is the intrinsic emojibase dataset loaded on demand.
    chunkSizeWarningLimit: 650,
    outDir: mode === "device" ? "dist-device" : "dist",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "world-local-backend": path.resolve(__dirname, "../backend/src/local-app.ts"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    host: "127.0.0.1",
    hmr: {
      host: "127.0.0.1",
      clientPort: 5173,
    },
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5555",
        changeOrigin: true
      }
    }
  }
}));
