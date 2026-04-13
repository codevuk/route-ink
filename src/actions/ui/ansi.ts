export const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
} as const;

export const stripAnsi = (text: string): string => text.replace(/\x1b\[[0-9;]*m/g, "");

export const color = (text: string, code: string): string => `${code}${text}${ANSI.reset}`;