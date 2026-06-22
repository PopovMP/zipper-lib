/// <reference lib="dom" />

import { type IZipper, makeZipper } from "../zipper-lib.ts";

document.addEventListener("DOMContentLoaded", main);

function main(): void {
    const downloadButton: HTMLElement | null = document.getElementById("download-button");
    if (downloadButton) {
        downloadButton.addEventListener("click", () => {
            void exportTestArchive();
        });
    }
}

async function exportTestArchive(): Promise<void> {
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

    downloadBytesAsFile("archive.zip", zip);
}

function downloadBytesAsFile(filename: string, data: Uint8Array): void {
    const binary : ArrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    const blobUrl: string      = URL.createObjectURL(new Blob([binary], { type: "application/zip" }));
    const anchor = document.createElement("a");

    anchor.href     = blobUrl;
    anchor.download = filename;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(blobUrl);
}
