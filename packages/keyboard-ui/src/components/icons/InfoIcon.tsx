import type { ComponentPropsWithoutRef } from 'react';
/** Info glyph. Native SVG attributes override its default size; geometry is preserved.
 */
export function InfoIcon(props: ComponentPropsWithoutRef<'svg'>) {
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <mask
        id="info_svg__a"
        style={{
          maskType: 'alpha',
        }}
        maskUnits="userSpaceOnUse"
        x={0}
        y={0}
        width={16}
        height={16}
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M8 14.25a6.25 6.25 0 1 0 0-12.5 6.25 6.25 0 0 0 0 12.5ZM15.75 8A7.75 7.75 0 1 1 .25 8a7.75 7.75 0 0 1 15.5 0Z"
          fill="#fff"
        />
        <path d="M7.25 5.5a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0Z" fill="#fff" />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M8 11.75a.75.75 0 0 1-.75-.75V8a.75.75 0 0 1 1.5 0v3a.75.75 0 0 1-.75.75Z"
          fill="#fff"
        />
      </mask>
      <g mask="url(#info_svg__a)">
        <path fill="currentColor" d="M0 0h16v16H0z" />
      </g>
    </svg>
  );
}
