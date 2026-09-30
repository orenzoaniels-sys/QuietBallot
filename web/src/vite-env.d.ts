/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PROOF_SERVER_URL?: string;
  readonly VITE_CONTRACT_ADDRESS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
