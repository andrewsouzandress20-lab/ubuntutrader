// env.d.ts
// Tipagem global para uso de import.meta.env no Vite e Node.js

interface ImportMetaEnv {
  [key: string]: string | undefined;
}

interface ImportMeta {
  env: ImportMetaEnv;
}
