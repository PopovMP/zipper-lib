import { describe, it } from "node:test";
import { strictEqual, deepStrictEqual } from "node:assert";

import { type IZipper, type IZipHeader, type IUnZipper, makeUnZipper, makeZipper } from "../zipper-lib.ts";

await describe("zipper", () => {
    void it("Empty", () => {
        const zipper: IZipper = makeZipper();
        const zip: Uint8Array = zipper.getZip();

        const unZipper: IUnZipper = makeUnZipper(zip);
        const headers: IZipHeader[] = unZipper.getHeaders();

        strictEqual(headers.length, 0, "No entries");
    });

    void it("One dir", () => {
        const dirPath = "my/dir/path/";
        const mtimeMs = Date.parse("2026-04-01T19:31:12");
        const mode    = 0o777;

        const zipper: IZipper = makeZipper();

        zipper.appendDir(dirPath, { mtimeMs, mode });
        const zip: Uint8Array = zipper.getZip();

        const unZipper: IUnZipper = makeUnZipper(zip);
        const headers : IZipHeader[] = unZipper.getHeaders();

        strictEqual(headers.length, 1, "It gets one dir");

        const header = headers[0];
        strictEqual(header.path,    dirPath);
        strictEqual(header.mtimeMs, mtimeMs);
        strictEqual(header.mode,    mode);
    });

    void it("One file", async () => {
        const filePath = "my/small-file.txt";
        const mtimeMs  = Date.parse("2026-04-01T19:31:12");
        const mode     = 0o744;
        const content  = new TextEncoder().encode("Hello, World!\n");

        const zipper: IZipper = makeZipper();

        await zipper.appendFile(filePath, content, { mtimeMs, mode });
        const zip: Uint8Array = zipper.getZip();

        const unZipper: IUnZipper = makeUnZipper(zip);
        const headers : IZipHeader[] = unZipper.getHeaders();

        strictEqual(headers.length, 1, "It gets one file");

        const header = headers[0];
        strictEqual(header.path,    filePath);
        strictEqual(header.mtimeMs, mtimeMs);
        strictEqual(header.mode,    mode);

        const actual: Uint8Array = await unZipper.getContent(filePath);
        deepStrictEqual(actual, content, "Small file content");
    });

    void it("Big file", async () => {
        const filePath = "my/big/file.txt";
        const mtimeMs  = Date.parse("2026-04-07T19:31:12");
        const content  = new TextEncoder().encode(("Hello, World!\n").repeat(100));

        const zipper: IZipper = makeZipper();
        await zipper.appendFile(filePath, content, { mtimeMs });
        const zip: Uint8Array = zipper.getZip();

        const unZipper: IUnZipper = makeUnZipper(zip);
        const actual: Uint8Array = await unZipper.getContent(filePath);

        deepStrictEqual(actual, content, "Big file content");
    });
});
