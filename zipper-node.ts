import { deflateRaw } from "node:zlib";

import { type IZipper, makeZipperLib } from "./zipper-lib.ts";

export type { IZipper, IZipperDirOptions, IZipperFileOptions } from "./zipper-lib.ts";

export function makeZipper(): IZipper {
    async function deflatePromiseNode(buffer: Uint8Array): Promise<Uint8Array> {
        return new Promise((resolve, reject) => {
            deflateRaw(buffer, (err: Error | null, data: Buffer): void => {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            });
        });
    }

    return makeZipperLib(deflatePromiseNode);
}
