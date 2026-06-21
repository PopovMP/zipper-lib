/// <reference lib="dom" />

import { type IZipper, makeZipperLib }  from "./zipper-lib.ts";
export type { IZipper, IZipperOptions } from "./zipper-lib.ts";

export function makeZipper(): IZipper {
    return makeZipperLib(deflatePromiseBrowser);

    async function deflatePromiseBrowser(buffer: Uint8Array): Promise<Uint8Array> {
        const blob       = new globalThis.Blob([buffer as unknown as BlobPart]);
        const deflateRaw = new globalThis.CompressionStream("deflate-raw");
        const compressedStream = blob.stream().pipeThrough(deflateRaw);
        const compressedBuffer: ArrayBuffer = await new globalThis.Response(compressedStream).arrayBuffer();
        return new Uint8Array(compressedBuffer);
    }
}
