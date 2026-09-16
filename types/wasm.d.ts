declare module '*.wasm' {
  const src: string;
  export default src;
}

declare module '@embedpdf/pdfium/pdfium.wasm' {
  const src: string;
  export default src;
}
