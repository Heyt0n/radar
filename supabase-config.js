// ==========================================
// CONFIGURATION GLOBALE DE LA BASE SUPABASE
// ==========================================
const SUPABASE_URL = "https://vyrnkiedotmwrzoigziq.supabase.co/rest/v1/";
const SUPABASE_ANON_KEY = "sb_publishable_96xOoNLDIl4j_wrJdrdrRA_PfUCetYb";

// Initialisation du client unique Supabase
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
