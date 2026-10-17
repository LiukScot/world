import { beforeEach, describe, expect, test, vi } from "vitest";

const isNativePlatform = vi.fn();
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform } }));

const readdir = vi.fn();
const readFile = vi.fn();
const deleteFile = vi.fn();
vi.mock("@capacitor/filesystem", () => ({
  Directory: { Cache: "CACHE" },
  Filesystem: { readdir, readFile, deleteFile },
}));

const { takeSharedPdfs } = await import("./shared-pdf");

beforeEach(() => {
  vi.clearAllMocks();
  isNativePlatform.mockReturnValue(true);
});

describe("takeSharedPdfs", () => {
  test("returns nothing in a browser", async () => {
    isNativePlatform.mockReturnValue(false);
    expect(await takeSharedPdfs()).toEqual([]);
    expect(readdir).not.toHaveBeenCalled();
  });

  test("returns nothing before anything was shared", async () => {
    readdir.mockRejectedValue(new Error("Folder does not exist."));
    expect(await takeSharedPdfs()).toEqual([]);
  });

  test("reads shared PDFs, skips half-copied files and deletes what it read", async () => {
    readdir.mockResolvedValue({ files: [{ name: "statement.pdf" }, { name: "statement.pdf.part" }] });
    readFile.mockResolvedValue({ data: btoa("%PDF") });

    const files = await takeSharedPdfs();

    expect(files.map((file) => file.name)).toEqual(["statement.pdf"]);
    expect(await files[0].text()).toBe("%PDF");
    expect(deleteFile).toHaveBeenCalledOnce();
    expect(deleteFile).toHaveBeenCalledWith({ path: "shared-pdf/statement.pdf", directory: "CACHE" });
  });

  test("simultaneous callers share one read", async () => {
    readdir.mockResolvedValue({ files: [{ name: "a.pdf" }] });
    readFile.mockResolvedValue({ data: btoa("%PDF") });

    const [first, second] = await Promise.all([takeSharedPdfs(), takeSharedPdfs()]);

    expect(first).toBe(second);
    expect(readFile).toHaveBeenCalledOnce();
  });
});
