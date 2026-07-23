/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SECRET_DOWNLOAD_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
