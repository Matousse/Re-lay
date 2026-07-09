import { Fragment } from "react";

// Markdown-lite for assistant replies: **bold**, `code` and pipe tables,
// rendered as real React nodes (no HTML parsing, nothing injectable).
// Newlines in text blocks are left to the parent's `whitespace-pre-wrap`;
// anything fancier degrades to readable plain text.

type Block =
  { kind: "text"; content: string } | { kind: "table"; header: string[] | null; rows: string[][] };

const isTableRow = (line: string) => /^\s*\|.*\|\s*$/.test(line);
const isSeparator = (line: string) => /^\s*\|[\s\-:|]+\|\s*$/.test(line);

const splitRow = (line: string) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());

function parseBlocks(text: string): Block[] {
  const lines = text.split("\n");
  const blocks: Block[] = [];
  let buffer: string[] = [];

  const flush = () => {
    if (buffer.length > 0) {
      blocks.push({ kind: "text", content: buffer.join("\n") });
      buffer = [];
    }
  };

  let index = 0;
  while (index < lines.length) {
    if (isTableRow(lines[index])) {
      const tableLines: string[] = [];
      while (index < lines.length && isTableRow(lines[index])) {
        tableLines.push(lines[index]);
        index++;
      }
      // A lone pipe line is prose, not a table.
      if (tableLines.length < 2) {
        buffer.push(...tableLines);
        continue;
      }
      flush();
      const hasHeader = tableLines.length > 1 && isSeparator(tableLines[1]);
      const cells = tableLines.filter((line) => !isSeparator(line)).map(splitRow);
      blocks.push(
        hasHeader
          ? { kind: "table", header: cells[0] ?? null, rows: cells.slice(1) }
          : { kind: "table", header: null, rows: cells },
      );
      continue;
    }
    buffer.push(lines[index]);
    index++;
  }
  flush();
  return blocks;
}

function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
          return (
            <strong key={index} className="font-semibold">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
          return (
            <code
              key={index}
              className="bg-foreground/[0.06] rounded px-1 py-0.5 font-mono text-[0.85em]"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        return part;
      })}
    </>
  );
}

function Table({ header, rows }: { header: string[] | null; rows: string[][] }) {
  return (
    <div className="border-border/70 my-1.5 overflow-x-auto rounded-md border whitespace-normal">
      <table className="w-full border-collapse text-xs">
        {header && (
          <thead>
            <tr className="bg-muted/60 border-b">
              {header.map((cell, index) => (
                <th key={index} className="px-2 py-1 text-left font-semibold">
                  <Inline text={cell} />
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b last:border-0">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-2 py-1 align-top">
                  <Inline text={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RichText({ text }: { text: string }) {
  return (
    <>
      {parseBlocks(text).map((block, index) => (
        <Fragment key={index}>
          {block.kind === "text" ? (
            <Inline text={block.content} />
          ) : (
            <Table header={block.header} rows={block.rows} />
          )}
        </Fragment>
      ))}
    </>
  );
}
