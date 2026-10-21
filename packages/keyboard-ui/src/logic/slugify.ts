/** Retained label-to-test-ID conversion; punctuation, whitespace and case rules are unchanged. */
export function slugify(value: { toString(): string }) {
  return value
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}
