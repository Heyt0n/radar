// ==========================================
// CONFIGURATION GLOBALE DE LA BASE SUPABASE
// ==========================================

// 1. URL racine de ton projet Supabase (sans /rest/v1/)
const SUPABASE_URL = "https://iikswhmkacwfnraqdsxi.supabase.co";

// 2. Ta clé d'API publique (Clé publiable copiée depuis ton tableau de bord)
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlpa3N3aG1rYWN3Zm5yYXFkc3hpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4OTY0ODIsImV4cCI6MjEwMDQ3MjQ4Mn0.vit8QQf2c0wGsasEIS206ZrGI0cmx-vLcgbPRFUIUvg";

// 3. Initialisation du client unique Supabase pour toute l'application
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
