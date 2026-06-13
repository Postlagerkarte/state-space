import { defineConfig } from 'vite';

export default defineConfig({
  // relative base so the built site works from any static host or subfolder
  base: './',
  server: {
    // Bind the IPv4 stack (0.0.0.0), not just IPv6 ::1. On Windows, Node/Vite
    // otherwise listens on ::1 only, but `localhost` often resolves to 127.0.0.1
    // first — so the browser gets "connection refused" even though Vite says it
    // is ready. Binding here also exposes the dev server on the LAN, so you can
    // open it on a real iPhone/iPad over Wi-Fi to test the touch feel.
    host: true,
  },
});
