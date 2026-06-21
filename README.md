# zip-lib

Small TypeScript ZIP writer for Node.js and browsers.

It creates ZIP archives in memory as Uint8Array.

## Features

- Create folders and files in a ZIP archive
- Supports UTF-8 entry names
- Supports file permissions and modified time metadata
- Uses raw deflate compression for larger files
- Works in Node.js and in modern browsers

## Public API

### makeZipper()

Create a zipper instance.

- Node entry: import from ./zipper-node.ts
- Browser entry: import from ./zipper-browser.ts

### IZipper

- appendDir(path, options?)
- appendFile(path, content, options?)
- emit()

### appendDir(path, options?)

Add a directory entry.

- path: string
	- Forward slashes are used in ZIP entries.
	- If path does not end with /, it is added automatically.
- options:
	- mtimeMs?: number
	- mode?: number (default 0o755)

### appendFile(path, content, options?)

Add a file entry.

- path: string
- content: string | Uint8Array | ArrayBuffer
- options:
	- mtimeMs?: number
	- mode?: number (default 0o644)

Note: current implementation auto-enables deflate for file content larger than 512 bytes.

### emit()

Returns a Uint8Array containing the full ZIP archive.

## Node.js Example

```ts
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { type IZipper, makeZipper } from "./zipper-node.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const zipPath = join(__dirname, "archive.zip");
const mtimeMs = new Date("2026-06-20T20:54:16").getTime();

const zipper: IZipper = makeZipper();

zipper.appendDir("nested", { mtimeMs });
zipper.appendDir("nested/empty", { mtimeMs, mode: 0o755 });

await zipper.appendFile("hello.txt", "Hello World!\n".repeat(100), { mtimeMs });
await zipper.appendFile("nested/data.bin", Uint8Array.from([0, 1, 2, 3, 4, 5]), { mtimeMs });
await zipper.appendFile("nested/echo.sh", "echo Hello World", { mtimeMs, mode: 0o744 });

const zip = zipper.emit();
writeFileSync(zipPath, zip);
```

## Browser Example

```ts
import { type IZipper, makeZipper } from "../zipper-browser.ts";

document.addEventListener("DOMContentLoaded", () => {
		const downloadButton = document.getElementById("download-button");
		if (!(downloadButton instanceof HTMLButtonElement)) {
				throw new Error("Expected #download-button to be a button.");
		}

		downloadButton.addEventListener("click", async (): Promise<void> => {
				const zipper: IZipper = makeZipper();
				const mtimeMs = Date.now();

				zipper.appendDir("nested", { mtimeMs });
				await zipper.appendFile("hello.txt", "Hello from browser\n".repeat(100), { mtimeMs });

				const zipBytes = zipper.emit();
				// Do something with the zipBytes
		});
});

```

## Build and Validate

Type check:

```bash
npm run check
```

Bundle browser demo:

```bash
npm run build
```

Run Node test script:

```bash
node ./test-node/test-zipper.ts
```

## Notes

- Browser compression uses CompressionStream with deflate-raw.
- Node compression uses node:zlib deflateRaw.
- ZIP output is generated in-memory, so very large archives can increase memory usage.
