"use strict";
var Zipper = (() => {
  // lib/zipper-lib.ts
  function makeZipperLib(deflatePromise) {
    const crc32Table = getCrc32Table();
    const chunks = [];
    const centralDirectoryChunks = [];
    let centralDirectorySize = 0;
    let localHeaderOffset = 0;
    let countEntries = 0;
    return {
      appendDir,
      appendFile,
      emit
    };
    function appendDir(path, options) {
      const dirEntry = {
        path: (path.endsWith("/") ? path : path + "/").replaceAll("\\", "/"),
        content: new Uint8Array(0),
        isDir: true,
        mtimeMs: options?.mtimeMs ?? Date.now(),
        mode: options?.mode ?? 493,
        deflate: false
      };
      void appendEntry(dirEntry);
    }
    async function appendFile(path, content, options) {
      const byteContent = toBytes(content);
      const fileEntry = {
        path: path.replaceAll("\\", "/"),
        content: byteContent,
        isDir: false,
        mtimeMs: options?.mtimeMs ?? Date.now(),
        mode: options?.mode ?? 420,
        deflate: byteContent.length > 512
      };
      return appendEntry(fileEntry);
    }
    async function appendEntry(entry) {
      const isDirectory = entry.isDir;
      const modTime = getModTime(entry.mtimeMs);
      const modDate = getModDate(entry.mtimeMs);
      const filenameBytes = encodeUtf8(entry.path);
      const sourceBytes = entry.content;
      let compressedBytes;
      if (entry.deflate) {
        compressedBytes = await deflatePromise(sourceBytes);
      } else {
        compressedBytes = sourceBytes;
      }
      const checksum = crc32(sourceBytes);
      const compression = entry.deflate ? 8 : 0;
      const externalAttrs = getExternalAttributes(isDirectory, entry.mode);
      const localFileHeader = createLittleEndianBuffer(30, (view) => {
        view.setUint32(0, 67324752, true);
        view.setUint16(4, 20, true);
        view.setUint16(6, 0, true);
        view.setUint16(8, compression, true);
        view.setUint16(10, modTime, true);
        view.setUint16(12, modDate, true);
        view.setUint32(14, checksum, true);
        view.setUint32(18, compressedBytes.length, true);
        view.setUint32(22, sourceBytes.length, true);
        view.setUint16(26, filenameBytes.length, true);
        view.setUint16(28, 0, true);
      });
      chunks.push(localFileHeader, filenameBytes, compressedBytes);
      const centralDirectoryHeader = createLittleEndianBuffer(46, (view) => {
        view.setUint32(0, 33639248, true);
        view.setUint16(4, 788, true);
        view.setUint16(6, 20, true);
        view.setUint16(8, 0, true);
        view.setUint16(10, compression, true);
        view.setUint16(12, modTime, true);
        view.setUint16(14, modDate, true);
        view.setUint32(16, checksum, true);
        view.setUint32(20, compressedBytes.length, true);
        view.setUint32(24, sourceBytes.length, true);
        view.setUint16(28, filenameBytes.length, true);
        view.setUint16(30, 0, true);
        view.setUint16(32, 0, true);
        view.setUint16(34, 0, true);
        view.setUint16(36, 0, true);
        view.setUint32(38, externalAttrs, true);
        view.setUint32(42, localHeaderOffset, true);
      });
      centralDirectoryChunks.push(centralDirectoryHeader, filenameBytes);
      centralDirectorySize += centralDirectoryHeader.length + filenameBytes.length;
      localHeaderOffset += localFileHeader.length + filenameBytes.length + compressedBytes.length;
      countEntries += 1;
    }
    function emit() {
      const centralDirectoryOffset = localHeaderOffset;
      const centralDirectory = concatBytes(centralDirectoryChunks);
      const endOfCentralDirectory = createLittleEndianBuffer(22, (view) => {
        view.setUint32(0, 101010256, true);
        view.setUint16(4, 0, true);
        view.setUint16(6, 0, true);
        view.setUint16(8, countEntries, true);
        view.setUint16(10, countEntries, true);
        view.setUint32(12, centralDirectorySize, true);
        view.setUint32(16, centralDirectoryOffset, true);
        view.setUint16(20, 0, true);
      });
      return concatBytes([...chunks, centralDirectory, endOfCentralDirectory]);
    }
    function encodeUtf8(text) {
      return new TextEncoder().encode(text);
    }
    function toBytes(data) {
      if (typeof data === "string") {
        return encodeUtf8(data);
      }
      if (data instanceof Uint8Array) {
        return data;
      }
      return new Uint8Array(data);
    }
    function getExternalAttributes(isDirectory, mode) {
      const perm = (mode ?? (isDirectory ? 493 : 420)) & 4095;
      const type = isDirectory ? 16384 : 32768;
      const unixMode = type | perm;
      const dosAttrs = isDirectory ? 16 : 0;
      return (unixMode & 65535) << 16 | dosAttrs;
    }
    function getCrc32Table() {
      const table = new Uint32Array(256);
      for (let index = 0; index < 256; index += 1) {
        let crc = index;
        for (let bit = 0; bit < 8; bit += 1) {
          crc = (crc & 1) !== 0 ? 3988292384 ^ crc >>> 1 : crc >>> 1;
        }
        table[index] = crc >>> 0;
      }
      return table;
    }
    ;
    function crc32(bytes) {
      let crc = 4294967295;
      for (const byte of bytes) {
        crc = crc32Table[(crc ^ byte) & 255] ^ crc >>> 8;
      }
      return (crc ^ 4294967295) >>> 0;
    }
    function getModTime(timeMs) {
      const date = new Date(timeMs);
      const hour = date.getHours();
      const minute = date.getMinutes();
      const second = Math.floor(date.getSeconds() / 2);
      return (hour & 31) << 11 | (minute & 63) << 5 | second & 31;
    }
    function getModDate(timeMs) {
      const date = new Date(timeMs);
      const year = Math.max(1980, date.getFullYear());
      const month = date.getMonth() + 1;
      const day = date.getDate();
      return (year - 1980 & 127) << 9 | (month & 15) << 5 | day & 31;
    }
    function createLittleEndianBuffer(size, write) {
      const bytes = new Uint8Array(size);
      write(new DataView(bytes.buffer));
      return bytes;
    }
    function concatBytes(arrays) {
      const totalLength = arrays.reduce((sum, chunk) => sum + chunk.length, 0);
      const output = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of arrays) {
        output.set(chunk, offset);
        offset += chunk.length;
      }
      return output;
    }
  }

  // lib/zipper-browser.ts
  function makeZipper() {
    async function deflatePromiseBrowser(buffer) {
      const webGlobal = globalThis;
      const blob = new webGlobal.Blob([buffer]);
      const deflateRaw = new webGlobal.CompressionStream("deflate-raw");
      const compressedStream = blob.stream().pipeThrough(deflateRaw);
      const compressedBuffer = await new webGlobal.Response(compressedStream).arrayBuffer();
      return new Uint8Array(compressedBuffer);
    }
    return makeZipperLib(deflatePromiseBrowser);
  }

  // index.ts
  document.addEventListener("DOMContentLoaded", main);
  function main() {
    const downloadButton = document.getElementById("download-button");
    if (downloadButton) {
      downloadButton.addEventListener("click", () => {
        void onDownloadButtonClick();
      });
    }
  }
  async function onDownloadButtonClick() {
    const mtimeMs = (/* @__PURE__ */ new Date("2026-06-20T20:54:16")).getTime();
    const zipper = makeZipper();
    zipper.appendDir("nested", { mtimeMs });
    zipper.appendDir("nested/empty", { mtimeMs, mode: 493 });
    await zipper.appendFile("hello.txt", "Hello World!\n".repeat(100));
    await zipper.appendFile("nested/data.bin", Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), { mtimeMs });
    await zipper.appendFile("nested/echo.sh", "echo Hello World", { mtimeMs, mode: 484 });
    const zip = zipper.emit();
    downloadBytesAsFile("archive.zip", zip);
  }
  function downloadBytesAsFile(filename, data) {
    const binary = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    const blobUrl = URL.createObjectURL(new Blob([binary], { type: "application/zip" }));
    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = filename;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(blobUrl);
  }
})();
