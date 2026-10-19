/// <reference types="vite/client" />

/** Variabel lingkungan kustom (diisi lewat berkas .env / .env.local). */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}
