import type { ComponentPropsWithoutRef } from 'react';
/** Close X glyph. Native SVG attributes override its default size; geometry is preserved.
 */
export function CloseXIcon(props: ComponentPropsWithoutRef<'svg'>) {
  return (
    <svg viewBox="0 0 20 20" width="1em" height="1em" {...props}>
      <path
        d="M10 8.586L18.586 0 20 1.414 11.414 10 20 18.586 18.586 20 10 11.414 1.414 20 0 18.586 8.586 10 0 1.414 1.414 0 10 8.586z"
        fill="currentColor"
        fillRule="evenodd"
      />
    </svg>
  );
}
