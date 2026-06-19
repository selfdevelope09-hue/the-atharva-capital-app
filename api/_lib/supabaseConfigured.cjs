function supabaseConfigured() {
  const url = String(process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || '').trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return Boolean(url && key);
}

module.exports = { supabaseConfigured };
