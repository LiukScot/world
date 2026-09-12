/**
 * Reads a bank statement PDF into transactions. One `statement-*` file per
 * bank; this one recognises which of them a document belongs to.
 */
export {
  CHERRY_ASSET,
  DEPOSIT_ASSET,
  linesFromFragments,
  ROBO_ASSET,
  StatementError,
  type ImportRow,
  type Pages,
  type ParsedStatement,
  type SkippedGroup,
  type TextFragment,
} from "./statement-core";

import { linesFromFragments, StatementError, type Pages, type ParsedStatement } from "./statement-core";
import { parseCherry } from "./statement-cherrybank";
import { parseRobo } from "./statement-revolut-robo";
import { parseSavings } from "./statement-revolut-savings";

/** Reads whichever of the supported statements the pages belong to. */
export function parseStatement(pages: Pages): ParsedStatement {
  const lines = pages.flatMap(linesFromFragments);
  if (lines.some((line) => line.startsWith("EUR Account summary"))) return parseRobo(lines);
  if (lines.some((line) => line.startsWith("Deposito senza vincoli"))) return parseSavings(pages, lines);
  if (lines.some((line) => line.includes("Cherry Bank"))) return parseCherry(pages, lines);
  throw new StatementError(
    "Unrecognised document. Supported: the Revolut robo-advisor and savings account statements, and the Cherry Bank current account statement.",
  );
}
