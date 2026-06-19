import { useEffect, useState } from 'react';

export function isDocumentVisible() {
  return typeof document === 'undefined' || !document.hidden;
}

/** True when the browser tab is in the foreground. */
export function useDocumentVisible() {
  const [visible, setVisible] = useState(isDocumentVisible);
  useEffect(() => {
    const onChange = () => setVisible(isDocumentVisible());
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
  return visible;
}
