"use strict";
var Zipper = (() => {
  // zipper-lib.ts
  function makeZipper() {
    const crc32Table = getCrc32Table();
    const entriesChunks = [];
    const directoryChunks = [];
    let countEntries = 0;
    let headerOffset = 0;
    let directorySize = 0;
    return {
      appendDir,
      appendFile,
      getZip
    };
    function appendDir(path, options) {
      const dirEntry = {
        path: (path.endsWith("/") ? path : path + "/").replaceAll("\\", "/"),
        content: new Uint8Array(0),
        isDir: true,
        mtimeMs: options?.mtimeMs ?? Date.now(),
        mode: options?.mode ?? 493
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
        mode: options?.mode ?? 420
      };
      return appendEntry(fileEntry);
    }
    async function appendEntry(entry) {
      const isDeflate = !entry.isDir && entry.content.length > 512;
      const compression = isDeflate ? 8 : 0;
      const modTime = getModTime(entry.mtimeMs);
      const modDate = getModDate(entry.mtimeMs);
      const checksum = crc32(entry.content);
      const filenameBytes = encodeUtf8(entry.path);
      const externalAttrs = getExternalAttributes(entry.isDir, entry.mode);
      let fileDataBytes;
      if (isDeflate) {
        fileDataBytes = await deflateRaw(entry.content);
      } else {
        fileDataBytes = entry.content;
      }
      const lfhBuffer = new Uint8Array(30);
      const lfhView = new DataView(lfhBuffer.buffer);
      lfhView.setUint32(0, 67324752, true);
      lfhView.setUint16(4, 20, true);
      lfhView.setUint16(6, 0, true);
      lfhView.setUint16(8, compression, true);
      lfhView.setUint16(10, modTime, true);
      lfhView.setUint16(12, modDate, true);
      lfhView.setUint32(14, checksum, true);
      lfhView.setUint32(18, fileDataBytes.length, true);
      lfhView.setUint32(22, entry.content.length, true);
      lfhView.setUint16(26, filenameBytes.length, true);
      lfhView.setUint16(28, 0, true);
      const cdhBuffer = new Uint8Array(46);
      const cdhView = new DataView(cdhBuffer.buffer);
      cdhView.setUint32(0, 33639248, true);
      cdhView.setUint16(4, 788, true);
      cdhView.setUint16(6, 20, true);
      cdhView.setUint16(8, 0, true);
      cdhView.setUint16(10, compression, true);
      cdhView.setUint16(12, modTime, true);
      cdhView.setUint16(14, modDate, true);
      cdhView.setUint32(16, checksum, true);
      cdhView.setUint32(20, fileDataBytes.length, true);
      cdhView.setUint32(24, entry.content.length, true);
      cdhView.setUint16(28, filenameBytes.length, true);
      cdhView.setUint16(30, 0, true);
      cdhView.setUint16(32, 0, true);
      cdhView.setUint16(34, 0, true);
      cdhView.setUint16(36, 0, true);
      cdhView.setUint32(38, externalAttrs, true);
      cdhView.setUint32(42, headerOffset, true);
      entriesChunks.push(lfhBuffer, filenameBytes, fileDataBytes);
      directoryChunks.push(cdhBuffer, filenameBytes);
      countEntries += 1;
      headerOffset += lfhBuffer.length + filenameBytes.length + fileDataBytes.length;
      directorySize += cdhBuffer.length + filenameBytes.length;
    }
    function getZip() {
      const ecdBuffer = new Uint8Array(22);
      const ecdView = new DataView(ecdBuffer.buffer);
      ecdView.setUint32(0, 101010256, true);
      ecdView.setUint16(4, 0, true);
      ecdView.setUint16(6, 0, true);
      ecdView.setUint16(8, countEntries, true);
      ecdView.setUint16(10, countEntries, true);
      ecdView.setUint32(12, directorySize, true);
      ecdView.setUint32(16, headerOffset, true);
      ecdView.setUint16(20, 0, true);
      const entriesBuffer = concatArrays(entriesChunks);
      const directoryBuffer = concatArrays(directoryChunks);
      return concatArrays([entriesBuffer, directoryBuffer, ecdBuffer]);
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
      const unixAttrs = type | perm;
      const dosAttrs = isDirectory ? 16 : 0;
      return (unixAttrs & 65535) << 16 | dosAttrs;
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
    function concatArrays(arrays) {
      const totalLength = arrays.reduce((sum, chunk) => sum + chunk.length, 0);
      const output = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of arrays) {
        output.set(chunk, offset);
        offset += chunk.length;
      }
      return output;
    }
    async function deflateRaw(input) {
      const inputBlob = new globalThis.Blob([input]);
      const uncompressedStream = inputBlob.stream();
      const deflateTransform = new globalThis.CompressionStream("deflate-raw");
      const compressedStream = uncompressedStream.pipeThrough(deflateTransform);
      const compressedResponse = new globalThis.Response(compressedStream);
      const compressedBuffer = await compressedResponse.arrayBuffer();
      return new Uint8Array(compressedBuffer);
    }
  }

  // test-browser/index.ts
  document.addEventListener("DOMContentLoaded", main);
  function main() {
    const downloadButton = document.getElementById("download-button");
    if (downloadButton) {
      downloadButton.addEventListener("click", () => {
        void exportTestArchive();
      });
    }
  }
  async function exportTestArchive() {
    const zipper = makeZipper();
    zipper.appendDir("nested");
    zipper.appendDir("nested/empty", { mode: 493 });
    await zipper.appendFile("hello.txt", "Hello World!\n".repeat(100), { mtimeMs: Date.parse("2026-06-18T18:33") });
    await zipper.appendFile("nested/data.bin", Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
    await zipper.appendFile("nested/echo.sh", "echo Hello World", { mtimeMs: Date.now(), mode: 484 });
    const zip = zipper.getZip();
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
