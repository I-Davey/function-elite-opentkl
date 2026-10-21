import type { ComponentPropsWithoutRef } from 'react';
/** Keyboard Perimeter glyph. Native SVG attributes override its default size; geometry is preserved.
 */
export function KeyboardPerimeterIcon(props: ComponentPropsWithoutRef<'svg'>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      fill="currentColor"
      viewBox="0 0 40 24"
      {...props}
    >
      <g clipPath="url(#keyboard_perimeter_svg__a)">
        <path d="M36 0H4C1.065 0 0 2.392 0 4v16c0 2.935 2.392 4 4 4h32c2.935 0 4-2.392 4-4V4c0-2.935-2.392-4-4-4m1.333 19.984c-.015.616-.258 1.35-1.333 1.35H4.016c-.616-.017-1.35-.259-1.35-1.334V4.016c.017-.616.26-1.35 1.334-1.35h31.984c.616.017 1.35.26 1.35 1.334z" />
      </g>
      <defs>
        <clipPath id="keyboard_perimeter_svg__a">
          <path d="M0 0h40v24H0z" />
        </clipPath>
      </defs>
    </svg>
  );
}
