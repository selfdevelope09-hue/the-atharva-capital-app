/** Extract missing column name from PostgREST / Supabase schema-cache errors. */
function parseMissingColumn(message) {
  const m = String(message || '').match(/Could not find the '([^']+)' column/i);
  return m ? m[1] : null;
}

function isSchemaColumnError(message) {
  return /schema cache|Could not find the '/i.test(String(message || ''));
}

/**
 * Write user row; strip unknown columns one-by-one until Supabase accepts the patch.
 */
async function writeUserPatch(supa, existing, uid, meta, patch) {
  let current = { ...patch };
  const baseInsert = {
    uid,
    email: meta.email || '',
    name: meta.name || 'Trader',
    photo_url: meta.photo_url || '',
    bio: meta.bio || ''
  };

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const res = existing
      ? await supa.from('users').update(current).eq('uid', uid)
      : await supa.from('users').insert({ ...baseInsert, ...current });

    if (!res.error) return;

    const missing = parseMissingColumn(res.error.message);
    if (missing && Object.prototype.hasOwnProperty.call(current, missing)) {
      delete current[missing];
      if (Object.keys(current).length === 0) break;
      continue;
    }

    if (isSchemaColumnError(res.error.message) && attempt === 0) {
      current = {
        virtual_balance: patch.virtual_balance,
        lifetime_realized_pnl: patch.lifetime_realized_pnl
      };
      if (patch.updated_at != null) current.updated_at = patch.updated_at;
      continue;
    }

    throw res.error;
  }

  const bare = await supa
    .from('users')
    .update({
      virtual_balance: patch.virtual_balance,
      lifetime_realized_pnl: patch.lifetime_realized_pnl
    })
    .eq('uid', uid);
  if (bare.error) throw bare.error;
}

/**
 * Supabase production DB may predate trading columns — never fail reset for missing cols.
 */
async function supabaseResetUser(supa, uid, meta, patchFull) {
  const { data: existing, error: findErr } = await supa.from('users').select('uid').eq('uid', uid).maybeSingle();
  if (findErr) throw findErr;
  await writeUserPatch(supa, !!existing, uid, meta, patchFull);
}

module.exports = { supabaseResetUser };
