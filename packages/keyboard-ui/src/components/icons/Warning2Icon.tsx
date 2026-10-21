import type { ComponentPropsWithoutRef } from 'react';
/** Warning2 glyph. Native SVG attributes override its default size; geometry is preserved.
 */
export function Warning2Icon(props: ComponentPropsWithoutRef<'svg'>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" width="1em" height="1em" {...props}>
      <rect width={16} height={16} rx={3} fill="#F7B500" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9 10.273V3H7v7.273h2zM7 13h2v-1.818H7V13z"
        fill="#1A1C1E"
      />
    </svg>
  );
}
