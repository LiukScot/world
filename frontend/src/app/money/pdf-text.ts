import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
// Vite emits the worker as its own asset and hands back the URL to load it from.
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import type { Pages } from "./pdf-import";

GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * The positioned text of every page, pages in order. A page reports text either
 * as fragments carrying a string and a position, or as structural markers that
 * carry neither; only the former hold anything to read. Positions are kept
 * because one of the statements lays its transactions out in columns rather
 * than in lines.
 */
export async function extractPages(data: ArrayBuffer): Promise<Pages> {
  const task = getDocument({ data });
  try {
    const pdf = await task.promise;
    const pages: Pages = [];
    for (let page = 1; page <= pdf.numPages; page += 1) {
      const content = await (await pdf.getPage(page)).getTextContent();
      pages.push(content.items.filter((item): item is TextItem => "str" in item));
    }
    return pages;
  } finally {
    await task.destroy();
  }
}
