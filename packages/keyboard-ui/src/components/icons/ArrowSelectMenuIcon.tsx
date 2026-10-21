import type { ComponentPropsWithoutRef } from 'react';
/** Arrow Select Menu glyph. Native SVG attributes override its default size; geometry is preserved.
 */
export function ArrowSelectMenuIcon(props: ComponentPropsWithoutRef<'svg'>) {
  return (
    <svg viewBox="0 0 12 16" width="1em" height="1em" {...props}>
      <path
        d="M1.518 6.723a.616.616 0 0 1-.45-.19.615.615 0 0 1-.19-.45c0-.174.062-.324.19-.45L5.55 1.15A.616.616 0 0 1 6 .96c.174 0 .324.063.45.19l4.483 4.483c.126.126.19.276.19.45a.616.616 0 0 1-.19.45.615.615 0 0 1-.45.19H1.517zm8.964 2.558c.174 0 .324.063.45.19.127.127.19.277.19.45a.616.616 0 0 1-.19.45L6.45 14.854a.615.615 0 0 1-.45.19.616.616 0 0 1-.45-.19L1.067 10.37a.615.615 0 0 1-.19-.45c0-.173.063-.323.19-.45a.616.616 0 0 1 .45-.19h8.965z"
        fill="currentColor"
        fillRule="evenodd"
      />
    </svg>
  );
}
