import { deflateRaw } from "node:zlib";

import { type IZipper, makeZipperLib }  from "./zipper-lib.ts";
export type { IZipper, IZipperOptions } from "./zipper-lib.ts";

export function makeZipper(): IZipper {
    return makeZipperLib(deflatePromiseNode);

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
}
