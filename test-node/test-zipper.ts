import { writeFileSync, existsSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { type IZipper, makeZipper } from "../lib/zipper-node.ts";

const zipPath: string = join(__dirname, "archive.zip");

if (existsSync(zipPath)) {
    unlinkSync(zipPath);
}

const mtimeMs = new Date("2026-06-20T20:54:16").getTime();

const zipper: IZipper = makeZipper();
zipper.appendDir("nested", { mtimeMs });
zipper.appendDir("nested/empty", { mtimeMs, mode: 0o755 });

await zipper.appendFile("hello.txt", "Hello World!\n".repeat(100), {mtimeMs});
await zipper.appendFile("nested/data.bin", Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), {mtimeMs});
await zipper.appendFile("nested/echo.sh", "echo Hello World", {mtimeMs, mode: 0o744});

const zip = zipper.emit();

writeFileSync(zipPath, zip);
