# zipper-lib

In-memory ZIP generator and reader for Node.js and browsers.

Zipper-lib is use for generating ZIP archive online for download or persisting in Node.js.

Unzipper-lib is used to extract content from ZIP created by zipper-lib.

Try a test archive.ts: (https://popovmp.github.io/zipper-lib/)

## Features

- Create folders and files in a ZIP archive in-memory
- Read ZIP headers and file content from generated archives
- Supports file permissions and modified time metadata
- Uses raw deflate compression for larger files
- Works in latest Node.js and browsers

## Quick example

```ts
import { type IUnZipper, type IZipper, makeZipper, makeUnZipper } from "@popovmp/zipper-lib";

const zipper: IZipper = makeZipper();
const filePath = "path/to/file.txt";
const content = new TextEncoder().encode("File content string");

zipper.appendDir("some/dir/", { mode: 0o755 });
await zipper.appendFile(filePath, content, { mode: 0o644 });
const zip: Uint8Array = zipper.getZip();

const unZipper: IUnZipper = makeUnZipper(zip);
const headers = unZipper.getHeaders();
const decoded = await unZipper.getContent(filePath);

console.log(headers[0].path);
console.log(decoded.length);
```

## Public API

### makeZipper()

Create a zipper instance.

```ts
import { type IZipper, makeZipper } from "@popovmp/zipper-lib";
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
//  - mode   : 0o644
await zipper.appendFile("path/to/file.txt", "File content string");
```

```ts
// Append binary file with explicit parameters
//  - mtimeMs: Date.now()
await zipper.appendFile("path/to/file.bin", Uint8Array.from([42, 43, 44]), { mode: 0o664 });
```


### getZip()

Returns a Uint8Array containing the full ZIP archive.

```ts
// Get the ZIP bytes
const zip: Uint8Array = zipper.getZip();
```

## Unzipper API

Import unzipper from the package subpath:

```ts
import { type IZipHeader, type IUnZipper, makeUnZipper } from "@popovmp/zipper-lib";
```

### makeUnZipper(zip)

Create an unzipper instance from ZIP bytes.

- zip: Uint8Array

```ts
const unZipper: IUnZipper = makeUnZipper(zip);
```

### getHeaders()

Returns all ZIP entries as headers.

- returns: IZipHeader[]
- IZipHeader fields:
	- path: string
	- isDir: boolean
	- mode: number
	- mtimeMs: number

```ts
const headers: IZipHeader[] = unZipper.getHeaders();
```

### getContent(path)

Returns decoded file bytes for a given file path.

- path: string
- returns: Promise<Uint8Array>

```ts
const bytes: Uint8Array = await unZipper.getContent("my/file");
```

## Round-trip examples (from tests)

```ts
import { type IZipHeader, type IUnZipper, type IZipper, makeZipper, makeUnZipper } from "@popovmp/zipper-lib";

// Make zipper
const zipper: IZipper = makeZipper();
const mtimeMs: number = Date.parse("2026-04-01T19:31:12");

// Append a directory
zipper.appendDir("my/dir/path/", { mtimeMs, mode: 0o777 });

// Append a file
await zipper.appendFile("my/file.txt", "Hello, World!\n", { mtimeMs });

// Get the ZIP archive
const zip: Uint8Array = zipper.getZip();

// Make UnZipper
const unZipper: IUnZipper = makeUnZipper(zip);

// Ge the archive content headers
const headers: IZipHeader[] = unZipper.getHeaders();

console.log(headers[0]); // => { isDir: true,  mode: 0o777, mtimeMs: 1775061072000, path: "my/dir/path/" }
console.log(headers[1]); // => { isDir: false, mode: 0o644, mtimeMs: 1775061072000, path: "my/file.txt"  }

// Get a file content
const content: Uint8Array = await unZipper.getContent(headers[1].path);
console.log( new TextDecoder().decode(content) ); // => "Hello, World!"
```

## Build and Validate

Type check and lint:

```bash
npm run check
npm run lint
npm run build:demo
```

Bundle browser demo:

```bash
npm run build
```

Build npm package artifacts (`dist/*.js` and `dist/*.d.ts`):

```bash
npm run build:pkg
```

Run Node test script:

```bash
node ./test-node/test-zipper.ts
// => ./test-node/archive.zip
```
