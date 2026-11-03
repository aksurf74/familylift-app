(function () {
  const config = window.FAMILYLIFT_CONFIG;

  if (!config?.supabaseUrl || !config?.supabasePublishableKey) {
    console.error("FamilyLift: Supabase-Konfiguration fehlt.");
    window.familyLiftSupabase = null;
    return;
  }

  if (!window.supabase?.createClient) {
    console.error("FamilyLift: Supabase Library wurde nicht geladen.");
    window.familyLiftSupabase = null;
    return;
  }

  window.familyLiftSupabase = window.supabase.createClient(
    config.supabaseUrl,
    config.supabasePublishableKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );
})();
