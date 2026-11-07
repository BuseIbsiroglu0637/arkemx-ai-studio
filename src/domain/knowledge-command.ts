
export function parseMemorySaveCommand(
  message: string
): string | null {
  const match = message.trim().match(
    /^(?:ece[,\s]+)?hafızana kaydet:\s*(.+)$/isu
  );

  if (!match) return null;

  const content = match[1].trim();

  if (content.length < 5 || content.length > 1000) {
    return null;
  }

  return content;
}
