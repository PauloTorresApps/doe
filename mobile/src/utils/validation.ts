export const KEYWORD_MIN_LENGTH = 3;
export const KEYWORD_MAX_COUNT = 5;

export function validateKeyword(expression: string): string | null {
  const trimmed = expression.trim();
  if (trimmed.length < KEYWORD_MIN_LENGTH) {
    return `A expressão deve ter pelo menos ${KEYWORD_MIN_LENGTH} caracteres`;
  }
  return null;
}

export function canAddKeyword(currentCount: number): boolean {
  return currentCount < KEYWORD_MAX_COUNT;
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateShort(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}
