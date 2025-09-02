/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_USE_MOCKS?: string;
  readonly VITE_TYPE_MIN?: string;
  readonly VITE_TYPE_MAX?: string;
  readonly VITE_TYPE_INTERVAL_MS?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

