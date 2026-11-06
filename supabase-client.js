(function(){
  const c=window.FAMILYLIFT_CONFIG;
  if(!c?.supabaseUrl||!c?.supabasePublishableKey||!window.supabase?.createClient){window.familyLiftSupabase=null;return}
  window.familyLiftSupabase=window.supabase.createClient(c.supabaseUrl,c.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
})();
