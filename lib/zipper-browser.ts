import { type IZipper, makeZipperLib } from "./zipper-lib.ts";

export type { IZipper, IZipperDirOptions, IZipperFileOptions } from "./zipper-lib.ts";

interface IWebCompressionGlobal {
    CompressionStream: new (format: string) => unknown;
    Response         : new (body?: unknown) => { arrayBuffer: () => Promise<ArrayBuffer> };
    Blob             : new (parts?: Uint8Array[] | ArrayBuffer[] | string[]) => { stream: () => { pipeThrough: (transform: unknown) => unknown } };
}

export function makeZipper(): IZipper {
    async function deflatePromiseBrowser(buffer: Uint8Array): Promise<Uint8Array> {
        const webGlobal: IWebCompressionGlobal = globalThis as unknown as IWebCompressionGlobal;

        const blob       = new webGlobal.Blob([buffer]);
        const deflateRaw = new webGlobal.CompressionStream("deflate-raw");
        const compressedStream = blob.stream().pipeThrough(deflateRaw);
        const compressedBuffer: ArrayBuffer = await new webGlobal.Response(compressedStream).arrayBuffer();
        return new Uint8Array(compressedBuffer);
    }

    return makeZipperLib(deflatePromiseBrowser);
}
