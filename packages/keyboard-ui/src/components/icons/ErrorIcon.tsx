import type { ComponentPropsWithoutRef } from 'react';
/** Error glyph. Native SVG attributes override its default size; geometry is preserved.
 */
export function ErrorIcon(props: ComponentPropsWithoutRef<'svg'>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" width="1em" height="1em" {...props}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 1.75a6.25 6.25 0 100 12.5 6.25 6.25 0 000-12.5zM.25 8a7.75 7.75 0 1115.5 0A7.75 7.75 0 01.25 8z"
        fill="currentColor"
      />
      <path d="M8.75 10.5a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" fill="currentColor" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 4.25a.75.75 0 01.75.75v3a.75.75 0 01-1.5 0V5A.75.75 0 018 4.25z"
        fill="currentColor"
      />
    </svg>
  );
}
