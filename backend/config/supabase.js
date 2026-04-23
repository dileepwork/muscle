const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn('Supabase URL and Anon Key are missing. Using in-memory local storage for this run.');
}

const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;

module.exports = {
  isSupabaseConfigured,
  supabase,
};
