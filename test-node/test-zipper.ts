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

// Make new zipper instance to start a new ZIP archive
const zipper: IZipper = makeZipper();

// Append directories
zipper.appendDir("nested");
zipper.appendDir("nested/empty", { mode: 0o755 }); // Set unix mode explicitly

// Append files
await zipper.appendFile("hello.txt", "Hello World!\n".repeat(100), { mtimeMs: Date.parse("2026-06-18T18:33") }); // Set modification time
await zipper.appendFile("nested/data.bin", Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
await zipper.appendFile("nested/echo.sh", "echo Hello World", { mtimeMs: Date.now(), mode: 0o744 }); // Make executable

// Produce the ZIP archive
const zip = zipper.getZip();

writeFileSync(zipPath, zip);
