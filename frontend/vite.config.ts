import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss(), react()],
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
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
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
});
