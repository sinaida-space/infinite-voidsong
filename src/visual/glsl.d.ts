// Vite `?raw` imports of shader sources resolve to the file text.
declare module '*.glsl?raw' {
  const source: string;
  export default source;
}
