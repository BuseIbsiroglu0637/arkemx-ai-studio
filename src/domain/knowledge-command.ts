
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

export function parseMemoryArchiveCommand(
  message: string
): string | null {
  const match = message.trim().match(
    /^(?:ece[,\s]+)?hafızandaki\s+(.+?)\s+kaydını\s+arşivle[.!]?$/iu
  );

  if (!match) return null;

  const title = match[1].trim();

  if (!title || title.length > 150) {
    return null;
  }

  return title;
}

export function parseMemoryRestoreCommand(
  message: string
): string | null {
  const match = message.trim().match(
    /^(?:ece[,\s]+)?hafızandaki\s+(.+?)\s+kaydını\s+geri\s+yükle[.!]?$/iu
  );

  if (!match) return null;

  const title = match[1].trim();

  if (!title || title.length > 150) {
    return null;
  }

  return title;
}

export function parseMemoryUpdateCommand(
  message: string
): { title: string; content: string } | null {
  const match = message.trim().match(
    /^(?:ece[,\s]+)?hafızandaki\s+(.+?)\s+kaydını\s+güncelle:\s*(.+)$/isu
  );

  if (!match) return null;

  const title = match[1].trim();
  const content = match[2].trim();

  if (
    !title ||
    title.length > 150 ||
    !content ||
    content.length > 5000
  ) {
    return null;
  }

  return { title, content };
}
