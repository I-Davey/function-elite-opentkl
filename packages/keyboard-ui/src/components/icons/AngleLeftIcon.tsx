import type { ComponentPropsWithoutRef } from 'react';
/** Angle Left glyph. Native SVG attributes override its default size; geometry is preserved.
 */
export function AngleLeftIcon(props: ComponentPropsWithoutRef<'svg'>) {
  return (
    <svg viewBox="0 0 11 18" width="1em" height="1em" {...props}>
      <path
        d="M.189 8.585L8.997.18a.612.612 0 0 1 .869 0l.945.902c.126.12.189.259.189.415a.557.557 0 0 1-.19.415L3.384 9l7.428 7.089c.126.12.189.258.189.414a.558.558 0 0 1-.19.415l-.944.902a.61.61 0 0 1-.87 0L.19 9.415A.558.558 0 0 1 0 9c0-.156.063-.294.189-.415z"
        fill="currentColor"
        fillRule="evenodd"
      />
    </svg>
  );
}
