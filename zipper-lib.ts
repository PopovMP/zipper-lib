export interface IZipperFileOptions {
    mtimeMs?: number;
    mode   ?: number;
}

export interface IZipperDirOptions {
    mtimeMs?: number;
    mode   ?: number;
}

export interface IZipper {
    appendDir : (path: string, options?: IZipperDirOptions) => void;
    appendFile: (path: string, content: string | Uint8Array | ArrayBuffer, options?: IZipperFileOptions) => Promise<void>;
    emit      : () => Uint8Array;
}

interface IZipperEntry {
    path   : string;
    content: Uint8Array;
    isDir  : boolean;
    mtimeMs: number;
    mode   : number;  // Example dir: 0o755, file: 0o644, executable: 0o744
    deflate: boolean; // If missing, true for files
}

export function makeZipperLib(deflatePromise: (buffer: Uint8Array) => Promise<Uint8Array>): IZipper {
    const crc32Table: Uint32Array  = getCrc32Table();
    const chunks    : Uint8Array[] = [];
    const centralDirectoryChunks: Uint8Array[] = [];

    let centralDirectorySize: number = 0;
    let localHeaderOffset   : number = 0;
    let countEntries        : number = 0;

    return {
        appendDir,
        appendFile,
        emit,
    };

    function appendDir(path: string, options?: IZipperDirOptions): void {
        const dirEntry: IZipperEntry = {
            path   : (path.endsWith("/") ? path : path + "/").replaceAll("\\", "/"),
            content: new Uint8Array(0),
            isDir  : true,
            mtimeMs: options?.mtimeMs ?? Date.now(),
            mode   : options?.mode    ?? 0o755,
            deflate: false,
        };

        void appendEntry(dirEntry);
    }

    async function appendFile(path: string, content: string | Uint8Array | ArrayBuffer, options?: IZipperFileOptions): Promise<void> {
        const byteContent: Uint8Array = toBytes(content);

        const fileEntry: IZipperEntry = {
            path   : path.replaceAll("\\", "/"),
            content: byteContent,
            isDir  : false,
            mtimeMs: options?.mtimeMs ?? Date.now(),
            mode   : options?.mode    ?? 0o644,
            deflate: byteContent.length > 512,
        };

        return appendEntry(fileEntry);
    }

    async function appendEntry(entry: IZipperEntry): Promise<void> {
        const isDirectory    : boolean    = entry.isDir;
        const modTime        : number     = getModTime(entry.mtimeMs);
        const modDate        : number     = getModDate(entry.mtimeMs);
        const filenameBytes  : Uint8Array = encodeUtf8(entry.path);
        const sourceBytes    : Uint8Array = entry.content;

        let compressedBytes: Uint8Array;
        if (entry.deflate) {
            compressedBytes = await deflatePromise(sourceBytes);
        } else {
            compressedBytes = sourceBytes;
        }

        const checksum     : number     = crc32(sourceBytes);
        const compression  : number     = entry.deflate ? 8 : 0;
        const externalAttrs: number     = getExternalAttributes(isDirectory, entry.mode);

        // Local File Header - 30 bytes
        const localFileHeader: Uint8Array = createLittleEndianBuffer(30, (view) => {
            view.setUint32( 0, 0x04034b50,             true); // Local file header signature 0x04034b50
            view.setUint16( 4, 0x14,                   true); // Version needed to extract (0x14 = 20 => 2.0)
            view.setUint16( 6, 0,                      true); // General purpose bit flag
            view.setUint16( 8, compression,            true); // Compression method: 0 - uncompressed, 8 - deflate
            view.setUint16(10, modTime,                true); // Last modification time - DOS format
            view.setUint16(12, modDate,                true); // Last modification date - DOS format
            view.setUint32(14, checksum,               true); // CRC-32 checksum
            view.setUint32(18, compressedBytes.length, true); // Compressed size
            view.setUint32(22, sourceBytes.length,     true); // Uncompressed size
            view.setUint16(26, filenameBytes.length,   true); // Entry name length
            view.setUint16(28, 0,                      true); // Extra field length
        });

        chunks.push(localFileHeader, filenameBytes, compressedBytes);

        // Central Directory File Header. 46 bytes + filename
        const centralDirectoryHeader: Uint8Array = createLittleEndianBuffer(46, (view) => {
            view.setUint32( 0, 0x02014b50,             true); // Signature 0x02014b50
            view.setUint16( 4, 0x0314,                 true); // Made on Unix (0x03), ZIP version 2.0 (0x14)
            view.setUint16( 6, 0x14,                   true); // Version needed to extract (0x14 = 20 => 2.0)
            view.setUint16( 8, 0,                      true); // General purpose bit flag
            view.setUint16(10, compression,            true); // Compression method: 0 - uncompressed, 8 - deflate
            view.setUint16(12, modTime,                true); // Last modification time - DOS format
            view.setUint16(14, modDate,                true); // Last modification date - DOS format
            view.setUint32(16, checksum,               true); // CRC-32 checksum
            view.setUint32(20, compressedBytes.length, true); // Compressed size
            view.setUint32(24, sourceBytes.length,     true); // Uncompressed size
            view.setUint16(28, filenameBytes.length,   true); // Entry name length
            view.setUint16(30, 0,                      true); // Extra field length
            view.setUint16(32, 0,                      true); // File comment length
            view.setUint16(34, 0,                      true); // Disk number where file starts
            view.setUint16(36, 0,                      true); // Internal file attributes
            view.setUint32(38, externalAttrs,          true); // External file attributes
            view.setUint32(42, localHeaderOffset,      true);
        });

        centralDirectoryChunks.push(centralDirectoryHeader, filenameBytes);
        centralDirectorySize += centralDirectoryHeader.length + filenameBytes.length;
        localHeaderOffset    += localFileHeader.length + filenameBytes.length + compressedBytes.length;
        countEntries         += 1;
    }

    function emit(): Uint8Array {
        const centralDirectoryOffset: number = localHeaderOffset;

        const centralDirectory: Uint8Array = concatBytes(centralDirectoryChunks);

        // End of Central Directory record. 22 bytes + comment
        const endOfCentralDirectory: Uint8Array = createLittleEndianBuffer(22, (view) => {
            view.setUint32( 0, 0x06054b50,             true); // Signature 0x06054b50
            view.setUint16( 4, 0,                      true); // Disk where Central Directory ends
            view.setUint16( 6, 0,                      true); // Disk where central directory starts
            view.setUint16( 8, countEntries,           true); // Number of central directory records on this disk
            view.setUint16(10, countEntries,           true); // Total number of central directory records
            view.setUint32(12, centralDirectorySize,   true); // Central directory size in bytes
            view.setUint32(16, centralDirectoryOffset, true); // Offset of start of central directory, relative to start of archive
            view.setUint16(20, 0,                      true); // Comment length
        });

        return concatBytes([...chunks, centralDirectory, endOfCentralDirectory]);
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
        const perm = (mode ?? (isDirectory ? 0o755 : 0o644)) & 0o7777;
        const type = isDirectory ? 0o040000 : 0o100000;
        const unixMode = type | perm;
        const dosAttrs = isDirectory ? 0x10 : 0x00;
        return ((unixMode & 0xFFFF) << 16) | dosAttrs;
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

    function createLittleEndianBuffer(size: number, write: (view: DataView) => void): Uint8Array {
        const bytes: Uint8Array = new Uint8Array(size);
        write(new DataView(bytes.buffer));
        return bytes;
    }

    function concatBytes(arrays: Uint8Array[]): Uint8Array {
        const totalLength: number = arrays.reduce((sum: number, chunk: Uint8Array): number => sum + chunk.length, 0);
        const output: Uint8Array = new Uint8Array(totalLength);

        let offset: number = 0;
        for (const chunk of arrays) {
            output.set(chunk, offset);
            offset += chunk.length;
        }

        return output;
    }
}
