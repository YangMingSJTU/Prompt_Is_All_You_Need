export function deriveSpellName(body: string, fallback: string): string {
  const normalized = body.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return fallback;
  }
  const maxLength = 28;
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}
