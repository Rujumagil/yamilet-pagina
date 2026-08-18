(() => {
  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';

  function isRecoveryRoute(){
    const query = new URLSearchParams(location.search);
    if(query.get('recovery') === '1' || query.get('mode') === 'recovery') return true;
    const hash = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash;
    return new URLSearchParams(hash).get('type') === 'recovery' || /(?:^|&)type=recovery(?:&|$)/.test(hash);
  }

  async function start(){
    if(isRecoveryRoute()) return;

    try{
      const response = await fetch(CONFIG_ENDPOINT,{headers:{Accept:'application/json'}});
      if(!response.ok) return;
      const cfg = await response.json();
      const client = window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
      const {data} = await client.auth.getSession();
      let hadSession = !!data.session;
      client.auth.onAuthStateChange((event,session)=>{
        if(isRecoveryRoute()) return;
        if(event==='SIGNED_OUT'){hadSession=false;return;}
        if(event==='SIGNED_IN' && session?.user && !hadSession){
          hadSession=true;
          setTimeout(()=>window.location.reload(),250);
        }
      });
    }catch(error){console.warn('Yamilet admin session bridge',error);}
  }
  window.addEventListener('load',start,{once:true});
})();
