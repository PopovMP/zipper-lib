# zipper-lib

Small TypeScript ZIP writer for Node.js and browsers.

It creates ZIP archives in memory as Uint8Array.

Try a test archive.ts: (https://popovmp.github.io/zipper-lib/)

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

```ts
// Import for browser
import { type IZipper, makeZipper } from "./lib/zipper-browser.ts";
const zipper: IZipper = makeZipper();
```

```ts
// Import for NodeJS
import { type IZipper, makeZipper } from "./lib/zipper-node.ts";
const zipper: IZipper = makeZipper();
```

### appendDir(path, options?)

Add a directory entry.

- path: string
	- Forward slashes are used in ZIP entries.
	- If path does not end with /, it is added automatically.
- options:
	- mtimeMs?: number (default now)
	- mode?   : number (default 0o755)

```ts
// Append a directory with default parameters:
//  - mtimeMs: Date.now()
//  - mode   : 0o755
zipper.appendDir("dirname");
```

```ts
// Append a directory with explicit parameters:
zipper.appendDir("sub/dir/name/", {mtimeMs, mode: 0o777});
```


### appendFile(path, content, options?)

Add a file entry.

- path: string
- content: string | Uint8Array | ArrayBuffer
- options:
	- mtimeMs?: number
	- mode   ?: number (default 0o644)

Note: current implementation compresses file content larger than 512 bytes.

```ts
// Append text file with default parameters
//  - mtimeMs: Date.now()
//  - mode   : 0o755
zipper.appendFile("path/to/file.txt", "File content string");
```

```ts
// Append binary file with explicit parameters
//  - mtimeMs: Date.now()
zipper.appendFile("path/to/file.bin", Uint8Array.from([42, 43, 44]), { mode: 0o644 });
```


### getZip()

Returns a Uint8Array containing the full ZIP archive.

```ts
// Get the ZIP bytes
const zip: Uint8Array = zipper.getZip();
```

## Full Example

```ts
// Import for browser
// import { type IZipper, makeZipper } from "./lib/zipper-browser.ts";

// Import for NodeJS
import { type IZipper, makeZipper } from "./lib/zipper-node.ts";

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
const zip: Uint8Array = zipper.getZip();

// Do something with the ZIP
```

## Build and Validate

Type check and lint:

```bash
npm run check
npm run lint
```

Bundle browser demo:

```bash
npm run build
```

Run Node test script:

```bash
node ./test-node/test-zipper.ts
// => ./test-node/archive.zip
```

## Notes

- Browser compression uses CompressionStream with deflate-raw.
- Node compression uses node:zlib deflateRaw.
- ZIP output is generated in-memory, so very large archives can increase memory usage.
