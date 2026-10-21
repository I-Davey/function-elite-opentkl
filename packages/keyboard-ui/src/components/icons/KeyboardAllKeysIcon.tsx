import type { ComponentPropsWithoutRef } from 'react';
/** Keyboard All Keys glyph. Native SVG attributes override its default size; geometry is preserved.
 */
export function KeyboardAllKeysIcon(props: ComponentPropsWithoutRef<'svg'>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      fill="currentColor"
      viewBox="0 0 39 24"
      {...props}
    >
      <path d="M3.9 0h31.2C37.962 0 39 2.392 39 4v16c0 2.935-2.332 4-3.9 4H3.9C1.038 24 0 21.608 0 20V4c0-2.935 2.332-4 3.9-4M2.6 19.984c.015.616.252 1.35 1.3 1.35h31.185c.6-.017 1.315-.259 1.315-1.334V4.016c-.015-.616-.253-1.35-1.3-1.35H3.915C3.315 2.684 2.6 2.927 2.6 4zM28.6 16H10.4v2.667h18.2zM7.8 16H5.2v2.667h2.6zm0-5.333H5.2v2.666h2.6zm5.2 0h-2.6v2.666H13zm2.6 2.666h2.6v-2.666h-2.6zm5.2 0h2.6v-2.666h-2.6zm5.2 0h2.6v-2.666H26zm7.8-2.666h-2.6v2.666h2.6zm0 5.333h-2.6v2.667h2.6zM7.8 5.333H5.2V8h2.6zm5.2 0h-2.6V8H13zM15.6 8h2.6V5.333h-2.6zm5.2 0h2.6V5.333h-2.6zM26 8h2.6V5.333H26zm7.8-2.667h-2.6V8h2.6z" />
    </svg>
  );
}
