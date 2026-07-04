/**
 * Flint speaks in plain prose. The system prompt asks for it, but models slip —
 * this strips any markdown that leaks through so the chat panel never shows
 * raw ** or ## markers. Pure and unit-tested; numbers pass through untouched
 * so the grounding guardrail is unaffected.
 */
export function toPlainProse(text: string): string {
  let out = text;

  // Headings: "## Why the Visa comes first" -> "Why the Visa comes first"
  out = out.replace(/^#{1,6}\s+/gm, '');

  // Bold/italic emphasis: **text**, __text__, *text*, _text_ -> text
  out = out.replace(/\*\*([^*]+)\*\*/g, '$1');
  out = out.replace(/__([^_]+)__/g, '$1');
  out = out.replace(/(^|\s)\*([^*\n]+)\*(?=[\s.,;:!?)]|$)/g, '$1$2');
  out = out.replace(/(^|\s)_([^_\n]+)_(?=[\s.,;:!?)]|$)/g, '$1$2');

  // Inline code: `text` -> text
  out = out.replace(/`([^`]+)`/g, '$1');

  // List markers: "- item" / "* item" / "1. item" -> "• item"
  out = out.replace(/^\s*[-*]\s+/gm, '• ');
  out = out.replace(/^\s*\d+\.\s+/gm, '• ');

  // Collapse 3+ blank lines left behind by removed structure
  out = out.replace(/\n{3,}/g, '\n\n');

  return out.trim();
}
