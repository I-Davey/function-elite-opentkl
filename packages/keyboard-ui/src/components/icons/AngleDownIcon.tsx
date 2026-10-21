import type { ComponentPropsWithoutRef } from 'react';
/** Angle Down glyph. Native SVG attributes override its default size; geometry is preserved.
 */
export function AngleDownIcon(props: ComponentPropsWithoutRef<'svg'>) {
  return (
    <svg viewBox="0 0 10 6" width="1em" height="1em" {...props}>
      <path
        d="M10 1L9 0c.332.034.255 0 0 0 .082 0 .005.034 0 0L5 4 1 0C.995.034.918 0 1 0 .745 0 .668.034 1 0L0 1C.033.687 0 .766 0 1c0-.055.033.024 0 0l5 5c-.164-.034-.087 0 0 0s.164-.034 0 0l5-5c-.033.024 0-.055 0 0 0-.234-.033-.313 0 0z"
        fill="currentColor"
        fillRule="evenodd"
      />
    </svg>
  );
}
