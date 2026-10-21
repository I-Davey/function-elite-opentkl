import type { ComponentPropsWithoutRef } from 'react';
/** Keyboard By Key glyph. Native SVG attributes override its default size; geometry is preserved.
 */
export function KeyboardByKeyIcon(props: ComponentPropsWithoutRef<'svg'>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      fill="currentColor"
      viewBox="0 0 22 13"
      {...props}
    >
      <g clipPath="url(#keyboard_by_key_svg__a)">
        <path d="M22 8.667h-4.4V13H22zM13.2 8.667H8.8V13h4.4zM4.4 8.667H0V13h4.4zM13.2 0H8.8v4.333h4.4z" />
      </g>
      <defs>
        <clipPath id="keyboard_by_key_svg__a">
          <path d="M0 0h22v13H0z" />
        </clipPath>
      </defs>
    </svg>
  );
}
