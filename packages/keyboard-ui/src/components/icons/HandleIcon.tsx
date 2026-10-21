import type { ComponentPropsWithoutRef } from 'react';
/** Handle glyph. Native SVG attributes override its default size; geometry is preserved.
 */
export function HandleIcon(props: ComponentPropsWithoutRef<'svg'>) {
  return (
    <svg viewBox="0 0 12 10" width="1em" height="1em" {...props}>
      <g fill="currentColor" fillRule="evenodd">
        <rect width={12} height={2} rx={1} />
        <rect y={4} width={12} height={2} rx={1} />
        <rect y={8} width={12} height={2} rx={1} />
      </g>
    </svg>
  );
}
