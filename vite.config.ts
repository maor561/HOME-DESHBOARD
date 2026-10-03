import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // NEXT_PUBLIC_ מאפשר לקרוא את משתני הסביבה שהחיבור של Supabase דרך Vercel יוצר אוטומטית
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  server: { port: 5180, host: true },
});
