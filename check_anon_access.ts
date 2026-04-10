
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NjEyODYsImV4cCI6MjA4NTIzNzI4N00.Ca9m25c9K0_J_kCRphGSaECGs8CGz4-zUpVoA_rIERA'; 
// Wait, I should use the one from supabaseClient.ts

const supabase = createClient(SUPABASE_URL, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NjEyODYsImV4cCI6MjA4NTIzNzI4Nn0.Ca9m25c9K0_J_kCRphGSaECGs8CGz4-zUpVoA_rIERA');

async function checkAnonAccess() {
  const { data, error } = await supabase
    .from('employees')
    .select('id, email')
    .eq('email', 'wida.oktapiani99@gmail.com')
    .maybeSingle();
    
  if (error) {
    console.log('Anon access error:', error.message);
  } else {
    console.log('Anon access data:', data);
  }
}

checkAnonAccess();
