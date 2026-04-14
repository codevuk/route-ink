import { ANSI, color, stripAnsi } from "./ansi.js";

const SEPARATOR = " — ";

export const printTable = (title: string, rows: string[], tone?: string) => {
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
    const plain = stripAnsi(message);
    const sepIdx = plain.lastIndexOf(SEPARATOR);

    let rowContent: string;

    if (sepIdx !== -1) {
      const prefix = plain.slice(0, sepIdx);
      const action = plain.slice(sepIdx + SEPARATOR.length);
      const innerPadding = " ".repeat(messageWidth - plain.length);
      const body = `${prefix}${innerPadding}${SEPARATOR}${action}`;
      rowContent = tone ? color(body, tone) : body;
    }
    else {
      const padding = " ".repeat(messageWidth - plain.length);
      rowContent = tone ? `${color(plain, tone)}${padding}` : `${plain}${padding}`;
    }

    console.log(` ${index.padEnd(indexWidth)} | ${rowContent} `);
  }

  console.log(divider);
};