/** Preserve the two recovered parsers, including actuation's acceptance of numeric data codes. */
export function lightingKeyCode(element: Element) {
  const value = element.getAttribute('data-code');
  if (!value?.includes('key-')) return null;
  const code = value.replace('key-', '');
  return code && !isNaN(Number(code)) ? Number(code) : null;
}
export function actuationKeyCode(element: Element) {
  const code = element.getAttribute('data-code')?.replace('key-', '');
  return code && !isNaN(Number(code)) ? Number(code) : null;
}
/** Select-all retains CAM's document-wide query; profile sets deduplicate repeated key views. */
export function selectableKeyCodes(parse: (element: Element) => number | null) {
  return Array.from(document.querySelectorAll('div[data-code]')).flatMap(
    (element) => parse(element) ?? [],
  );
}
