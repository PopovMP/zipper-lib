export interface IZipperOptions {
    mtimeMs?: number; // Default: Date.now()
    mode   ?: number; // Default: 0o755 for dirs and 0o644 for files
}

export interface IZipper {
    appendDir : (path: string, options?: IZipperOptions) => void;
    appendFile: (path: string, content: string | Uint8Array | ArrayBuffer, options?: IZipperOptions) => Promise<void>;
    getZip    : () => Uint8Array;
}

interface IZipperEntry {
    path   : string;
    content: Uint8Array;
    isDir  : boolean;
    mtimeMs: number;
    mode   : number;  // Example dir: 0o755, file: 0o644, executable: 0o744
}

export function makeZipper(): IZipper {
    const crc32Table     : Uint32Array  = getCrc32Table();
    const entriesChunks  : Uint8Array[] = [];
    const directoryChunks: Uint8Array[] = [];

    let countEntries : number = 0;
    let headerOffset : number = 0;
    let directorySize: number = 0;

    return {
        appendDir,
        appendFile,
        getZip,
    };

    function appendDir(path: string, options?: IZipperOptions): void {
        const dirEntry: IZipperEntry = {
            path   : (path.endsWith("/") ? path : path + "/").replaceAll("\\", "/"),
            content: new Uint8Array(0),
            isDir  : true,
            mtimeMs: options?.mtimeMs ?? Date.now(),
            mode   : options?.mode    ?? 0o755,
        };

        void appendEntry(dirEntry);
    }

    async function appendFile(path: string, content: string | Uint8Array | ArrayBuffer, options?: IZipperOptions): Promise<void> {
        const byteContent: Uint8Array = toBytes(content);

        const fileEntry: IZipperEntry = {
            path   : path.replaceAll("\\", "/"),
            content: byteContent,
            isDir  : false,
            mtimeMs: options?.mtimeMs ?? Date.now(),
            mode   : options?.mode    ?? 0o644,
        };

        return appendEntry(fileEntry);
    }

    async function appendEntry(entry: IZipperEntry): Promise<void> {
        const isDeflate    : boolean    = !entry.isDir && entry.content.length > 512;
        const compression  : number     = isDeflate ? 8 : 0;
        const gpFlags      : number     = 0x0800; // Bit 11: UTF-8 file name/comment
        const modTime      : number     = getModTime(entry.mtimeMs);
        const modDate      : number     = getModDate(entry.mtimeMs);
        const checksum     : number     = crc32(entry.content);
        const filenameBytes: Uint8Array = encodeUtf8(entry.path);
        const externalAttrs: number     = getExternalAttributes(entry.isDir, entry.mode);

        let fileDataBytes: Uint8Array;
        if (isDeflate) {
            fileDataBytes = await deflateRaw(entry.content);
        } else {
            fileDataBytes = entry.content;
        }

        // Local File Header - 30 bytes
        const lfhBuffer: Uint8Array = new Uint8Array(30);
        const lfhView  : DataView = new DataView(lfhBuffer.buffer);
        lfhView.setUint32( 0, 0x04034b50,           true); // Local file header signature 0x04034b50
        lfhView.setUint16( 4, 0x14,                 true); // Version needed to extract (0x14 = 20 => 2.0)
        lfhView.setUint16( 6, gpFlags,              true); // General purpose bit flag
        lfhView.setUint16( 8, compression,          true); // Compression method: 0 - uncompressed, 8 - deflate
        lfhView.setUint16(10, modTime,              true); // Last modification time - DOS format
        lfhView.setUint16(12, modDate,              true); // Last modification date - DOS format
        lfhView.setUint32(14, checksum,             true); // CRC-32 checksum
        lfhView.setUint32(18, fileDataBytes.length, true); // Compressed size
        lfhView.setUint32(22, entry.content.length, true); // Uncompressed size
        lfhView.setUint16(26, filenameBytes.length, true); // Entry name length
        lfhView.setUint16(28, 0,                    true); // Extra field length

        // Central Directory Header - 46 bytes
        const cdhBuffer: Uint8Array = new Uint8Array(46);
        const cdhView  : DataView   = new DataView(cdhBuffer.buffer);
        cdhView.setUint32( 0, 0x02014b50,           true); // Signature 0x02014b50
        cdhView.setUint16( 4, 0x0314,               true); // Made on Unix (0x03), ZIP version 2.0 (0x14)
        cdhView.setUint16( 6, 0x14,                 true); // Version needed to extract (0x14 = 20 => 2.0)
        cdhView.setUint16( 8, gpFlags,              true); // General purpose bit flag
        cdhView.setUint16(10, compression,          true); // Compression method: 0 - uncompressed, 8 - deflate
        cdhView.setUint16(12, modTime,              true); // Last modification time - DOS format
        cdhView.setUint16(14, modDate,              true); // Last modification date - DOS format
        cdhView.setUint32(16, checksum,             true); // CRC-32 checksum
        cdhView.setUint32(20, fileDataBytes.length, true); // Compressed size
        cdhView.setUint32(24, entry.content.length, true); // Uncompressed size
        cdhView.setUint16(28, filenameBytes.length, true); // Entry name length
        cdhView.setUint16(30, 0,                    true); // Extra field length
        cdhView.setUint16(32, 0,                    true); // File comment length
        cdhView.setUint16(34, 0,                    true); // Disk number where file starts
        cdhView.setUint16(36, 0,                    true); // Internal file attributes
        cdhView.setUint32(38, externalAttrs,        true); // External file attributes
        cdhView.setUint32(42, headerOffset,         true); // Offset from the start of the archive

        entriesChunks  .push(lfhBuffer, filenameBytes, fileDataBytes);
        directoryChunks.push(cdhBuffer, filenameBytes);

        countEntries  += 1;
        headerOffset  += lfhBuffer.length + filenameBytes.length + fileDataBytes.length;
        directorySize += cdhBuffer.length + filenameBytes.length;
    }

    function getZip(): Uint8Array {
        // End of Central Directory record - 22 bytes
        const ecdBuffer: Uint8Array = new Uint8Array(22);
        const ecdView  : DataView   = new DataView(ecdBuffer.buffer);
        ecdView.setUint32( 0, 0x06054b50,    true); // Signature 0x06054b50
        ecdView.setUint16( 4, 0,             true); // Disk where Central Directory ends
        ecdView.setUint16( 6, 0,             true); // Disk where central directory starts
        ecdView.setUint16( 8, countEntries,  true); // Number of central directory records on this disk
        ecdView.setUint16(10, countEntries,  true); // Total number of central directory records
        ecdView.setUint32(12, directorySize, true); // Central directory size in bytes
        ecdView.setUint32(16, headerOffset,  true); // Offset of start of central directory, relative to start of archive
        ecdView.setUint16(20, 0,             true); // Comment length

        const entriesBuffer  : Uint8Array = concatArrays(entriesChunks);
        const directoryBuffer: Uint8Array = concatArrays(directoryChunks);

        return concatArrays([entriesBuffer, directoryBuffer, ecdBuffer]);
    }

    function encodeUtf8(text: string): Uint8Array {
        return new TextEncoder().encode(text);
    }

    function toBytes(data: string | Uint8Array | ArrayBuffer): Uint8Array {
        if (typeof data === "string") {
            return encodeUtf8(data);
        }

        if (data instanceof Uint8Array) {
            return data;
        }

        return new Uint8Array(data);
    }

    function getExternalAttributes(isDirectory: boolean, mode?: number): number {
        const perm      = (mode ?? (isDirectory ? 0o755 : 0o644)) & 0o7777;
        const type      = isDirectory ? 0o040000 : 0o100000;
        const unixAttrs = type | perm;
        const dosAttrs  = isDirectory ? 0x10 : 0x00;

        return ((unixAttrs & 0xFFFF) << 16) | dosAttrs;
    }

    function getCrc32Table(): Uint32Array {
        const table: Uint32Array = new Uint32Array(256);

        for (let index = 0; index < 256; index += 1) {
            let crc: number = index;

            for (let bit = 0; bit < 8; bit += 1) {
                crc = (crc & 1) !== 0 ? (0xEDB88320 ^ (crc >>> 1)) : (crc >>> 1);
            }

            table[index] = crc >>> 0;
        }

        return table;
    };

    function crc32(bytes: Uint8Array): number {
        let crc: number = 0xFFFFFFFF;

        for (const byte of bytes) {
            crc = crc32Table[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
        }

        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    /**
     * Makes DOS format time: hhhh_hmmm_mmms_ssss
     */
    function getModTime(timeMs: number): number {
        const date  : Date   = new Date(timeMs);
        const hour  : number = date.getHours();
        const minute: number = date.getMinutes();
        const second: number = Math.floor(date.getSeconds() / 2);

        return ((hour & 0b1_1111) << 11) | ((minute & 0b11_1111) << 5) | (second & 0b1_1111);
    }

    /**
     * Makes DOS format date: yyyy_yyym_mmmd_dddd
     */
    function getModDate(timeMs: number): number {
        const date : Date   = new Date(timeMs);
        const year : number = Math.max(1980, date.getFullYear());
        const month: number = date.getMonth() + 1;
        const day  : number = date.getDate();

        return (((year - 1980) & 0b111_1111) << 9) | ((month & 0b1111) << 5) | (day & 0b1_1111);
    }

    function concatArrays(arrays: Uint8Array[]): Uint8Array {
        const totalLength: number = arrays.reduce((sum: number, chunk: Uint8Array): number => sum + chunk.length, 0);
        const output: Uint8Array = new Uint8Array(totalLength);

        let offset: number = 0;
        for (const chunk of arrays) {
            output.set(chunk, offset);
            offset += chunk.length;
        }

        return output;
    }

    async function deflateRaw(input: Uint8Array): Promise<Uint8Array> {
        const inputBlob         : Blob              = new globalThis.Blob([input as unknown as ArrayBuffer]);
        const uncompressedStream: ReadableStream    = inputBlob.stream();
        const deflateTransform  : CompressionStream = new globalThis.CompressionStream("deflate-raw");
        const compressedStream  : ReadableStream    = uncompressedStream.pipeThrough(deflateTransform);
        const compressedResponse: Response          = new globalThis.Response(compressedStream);
        const compressedBuffer  : ArrayBuffer       = await compressedResponse.arrayBuffer();

        return new Uint8Array(compressedBuffer);
    }
}
