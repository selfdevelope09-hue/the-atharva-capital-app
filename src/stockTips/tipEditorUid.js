/**
 * Primary product owner Firebase Auth UID — dev panel + stock tip writes.
 * Must match `primaryStockTipOwnerUid()` in firestore.rules if you change it.
 * Extra editors: add to Firestore `config/stockTipEditors` field `uids`, or
 * set REACT_APP_STOCK_TIP_EDITOR_UIDS (comma-separated) for UI + rules still need Firestore for those.
 */
export const PRIMARY_STOCK_TIP_OWNER_UID = '8i1gWBZLj7NOdWTTj3Cg4sgCW4I2';

export function extraTipEditorUidsFromEnv() {
  return (process.env.REACT_APP_STOCK_TIP_EDITOR_UIDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function mergeTipEditorFallbackUids(firestoreUids) {
  const arr = Array.isArray(firestoreUids) ? firestoreUids : [];
  return [...new Set([...arr, PRIMARY_STOCK_TIP_OWNER_UID, ...extraTipEditorUidsFromEnv()])];
}
