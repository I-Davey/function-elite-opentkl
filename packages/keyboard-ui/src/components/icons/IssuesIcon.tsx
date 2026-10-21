import type { ComponentPropsWithoutRef } from 'react';
/** Issues glyph. Native SVG attributes override its default size; geometry is preserved.
 */
export function IssuesIcon(props: ComponentPropsWithoutRef<'svg'>) {
  return (
    <svg viewBox="0 0 20 20" width="1em" height="1em" {...props}>
      <path
        d="M10 20C4.477 20 0 15.523 0 10S4.477 0 10 0s10 4.477 10 10-4.477 10-10 10zm1.5-17h-3L9 13h2l.5-10zm-1.492 14c.443 0 .802-.142 1.078-.427.276-.285.414-.646.414-1.082 0-.43-.14-.786-.418-1.068-.279-.282-.637-.423-1.074-.423-.431 0-.79.14-1.078.418-.287.279-.43.637-.43 1.073 0 .418.142.774.426 1.068.284.294.645.441 1.082.441z"
        fill="currentColor"
        fillRule="evenodd"
      />
    </svg>
  );
}
