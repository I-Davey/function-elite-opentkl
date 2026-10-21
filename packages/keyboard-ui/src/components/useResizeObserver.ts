import { useLayoutEffect, useRef, useState } from 'react';

/** Measure content-box dimensions; preserve the preview's initial zero-size/hidden state. */
export function useResizeObserver(initialState = { width: 0, height: 0 }) {
  const [dimensions, setDimensions] = useState(initialState);
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const target = ref.current;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries)
        setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    if (target) observer.observe(target);
    return () => {
      if (target) observer.unobserve(target);
    };
  }, [ref, ref.current]);
  return [ref, dimensions] as const;
}
