/** Mutable cookie store behind the mocked `next/headers` (see setup.ts). */
export const jar: Record<string, string> = {};
export const setCookies = (c: Record<string, string>) => {
  for (const k of Object.keys(jar)) delete jar[k];
  Object.assign(jar, c);
};
