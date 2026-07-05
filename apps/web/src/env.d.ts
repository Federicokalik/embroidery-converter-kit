/// <reference types="astro/client" />

// Embroidery fixtures imported as asset URLs (see astro.config.mjs assetsInclude).
declare module '*.vip?url' {
  const url: string;
  export default url;
}
declare module '*.jef?url' {
  const url: string;
  export default url;
}
declare module '*.pes?url' {
  const url: string;
  export default url;
}
declare module '*.dst?url' {
  const url: string;
  export default url;
}
