import { useEffect, useRef, type DependencyList, type EffectCallback } from 'react';

/** Run updates after the initial mount, forwarding effect cleanup unchanged. */
export function useDidUpdateEffect(effect: EffectCallback, dependencies: DependencyList) {
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) return effect();
    mounted.current = true;
  }, dependencies);
}
