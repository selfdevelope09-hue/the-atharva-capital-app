import { useContext, useEffect, useMemo, useState } from 'react';
import { AuthContext } from '../authContext';
import { fetchAdminEditors } from '../api/adminDevApi';
import { mergeTipEditorFallbackUids } from '../stockTips/tipEditorUid';

/** True when signed-in user can open /developer/* panels. */
export function useTipEditorAccess() {
  const { user } = useContext(AuthContext);
  const [editors, setEditors] = useState(null);

  useEffect(() => {
    if (!user?.uid) {
      setEditors(null);
      return undefined;
    }
    let cancelled = false;
    fetchAdminEditors()
      .then((list) => {
        if (!cancelled) setEditors(list);
      })
      .catch(() => {
        if (!cancelled) setEditors(mergeTipEditorFallbackUids([]));
      });
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const isEditor = useMemo(() => {
    if (!user?.uid || !editors) return false;
    return editors.includes(user.uid);
  }, [user?.uid, editors]);

  return { isEditor, editors, checking: !!user?.uid && editors === null };
}
