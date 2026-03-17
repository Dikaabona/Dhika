
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NjEyODYsImV4cCI6MjA4NTIzNzI4Nn0.Ca9m25c9K0_J_kCRphGSaECGs8CGz4-zUpVoA_rIERA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
  const today = '2026-03-17';
  const { data: contents, error } = await supabase
    .from('content_plans')
    .select('*, employees!content_plans_creatorId_fkey(nama)')
    .eq('postingDate', today);
    
  if (error) {
    // Fallback if join fails
    const { data: contentsDirect } = await supabase.from('content_plans').select('*').eq('postingDate', today);
    console.log("Contents today (direct):", contentsDirect);
  } else {
    console.log("Contents today:", contents);
  }
}

check();
