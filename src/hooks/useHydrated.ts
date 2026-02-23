import { useState, useEffect } from 'react';

let globalHasHydrated = false;

export const useHydrated = () => {
  const [hydrated, setHydrated] = useState(globalHasHydrated);

  useEffect(() => {
    if (!globalHasHydrated) {
      globalHasHydrated = true;
      setHydrated(true);
    }
  }, []);

  return hydrated;
};
