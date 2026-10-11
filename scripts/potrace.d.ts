// Minimal types for the parts of potrace that trace-motifs.ts uses.
declare module "potrace" {
  import type Jimp from "jimp";

  type Options = { threshold?: number; turdSize?: number; optTolerance?: number; alphaMax?: number; blackOnWhite?: boolean };

  export class Potrace {
    constructor(options?: Options);
    loadImage(target: Jimp | Buffer | string, callback: (err: Error | null) => void): void;
    getPathTag(fillColor?: string): string;
  }

  const potrace: { Potrace: typeof Potrace };
  export default potrace;
}
