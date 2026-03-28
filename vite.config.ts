import { defineConfig } from "vite";

export default defineConfig({
  // Relative asset URLs so production builds can be served from any path or static folder
  // without assuming a domain root; everything stays same-origin to that host.
  base: "./",
  server: {
    port: 5173,
  },
});
