/// <reference types="vite/client" />

declare module "*.svg?raw" {
  const src: string;
  export default src;
}

declare module "virtual:quotalis-legal-documents" {
  const documents: { license: string; notice: string; thirdPartyNotices: string };
  export default documents;
}

