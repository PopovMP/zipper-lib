/// <reference lib="dom" />

import { type IZipper, makeZipper } from "./lib/zipper-browser.ts";

document.addEventListener("DOMContentLoaded", main);

function main(): void {
    const downloadButton: HTMLElement | null = document.getElementById("download-button");
    if (downloadButton) {
        downloadButton.addEventListener("click", () => {
            void onDownloadButtonClick();
        });
    }
}

async function onDownloadButtonClick(): Promise<void> {
    const mtimeMs = new Date("2026-06-20T20:54:16").getTime();

    const zipper: IZipper = makeZipper();
    zipper.appendDir("nested", { mtimeMs });
    zipper.appendDir("nested/empty", { mtimeMs, mode: 0o755 });

    await zipper.appendFile("hello.txt", "Hello World!\n".repeat(100));
    await zipper.appendFile("nested/data.bin", Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), {mtimeMs});
    await zipper.appendFile("nested/echo.sh", "echo Hello World", {mtimeMs, mode: 0o744});

    const zip = zipper.emit();

    downloadBytesAsFile("archive.zip", zip);
}

function downloadBytesAsFile(filename: string, data: Uint8Array): void {
    const binary: ArrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    const blobUrl: string = URL.createObjectURL(new Blob([binary], { type: "application/zip" }));
    const anchor = document.createElement("a");

    anchor.href          = blobUrl;
    anchor.download      = filename;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(blobUrl);
}
