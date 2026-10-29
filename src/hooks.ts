import { useEffect, useState } from 'react';

/** Résout une promesse et suit son état ; relancée quand `deps` change. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data?: T; error?: Error; loading: boolean }>({ loading: true });
  useEffect(() => {
    let actif = true;
    setState((s) => ({ ...s, loading: true }));
    fn().then(
      (data) => actif && setState({ data, loading: false }),
      (error) => actif && setState({ error, loading: false }),
    );
    return () => {
      actif = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}
