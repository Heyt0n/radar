// ==========================================
// CONFIGURATION GLOBALE DE LA BASE SUPABASE
// ==========================================

// 1. URL racine de ton projet Supabase (sans /rest/v1/)
const SUPABASE_URL = "https://vyrnkiedotmwrzoigziq.supabase.co";

// 2. Ta clé d'API publique (Clé publiable copiée depuis ton tableau de bord)
const SUPABASE_ANON_KEY = "sb_publishable_96xOoNLDIl4j_wrJdrdrRA_PfUCetYb";

// 3. Initialisation du client unique Supabase pour toute l'application
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
