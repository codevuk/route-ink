import { ANSI, color, stripAnsi } from "./ansi.js";

export const printTable = (title: string, rows: string[]) => {
  if (rows.length === 0) {
    return;
  }

  const indexHeader = "#";
  const messageHeader = "Message";
  const indexedRows: Array<[string, string]> = rows.map((message, index) => [String(index + 1), message]);

  const indexWidth = Math.max(indexHeader.length, ...indexedRows.map(([index]) => stripAnsi(index).length));
  const messageWidth = Math.max(messageHeader.length, ...indexedRows.map(([, message]) => stripAnsi(message).length));

  const divider = `${"-".repeat(indexWidth + 2)}+${"-".repeat(messageWidth + 2)}`;

  console.log(`\n${color(title, ANSI.bold)}`);
  console.log(divider);
  console.log(` ${indexHeader.padEnd(indexWidth)} | ${messageHeader.padEnd(messageWidth)} `);
  console.log(divider);

  for (const [index, message] of indexedRows) {
    const plainLength = stripAnsi(message).length;
    const padding = Math.max(0, messageWidth - plainLength);

    console.log(` ${index.padEnd(indexWidth)} | ${message}${" ".repeat(padding)} `);
  }

  console.log(divider);
};