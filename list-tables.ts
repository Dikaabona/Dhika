
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NjEyODYsImV4cCI6MjA4NTIzNzI4Nn0.Ca9m25c9K0_J_kCRphGSaECGs8CGz4-zUpVoA_rIERA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function listTables() {
  const { data, error } = await supabase.rpc('get_tables');
  if (error) {
    console.log("RPC get_tables failed, trying alternative...");
    const { data: data2, error: error2 } = await supabase.from('pg_catalog.pg_tables').select('tablename').eq('schemaname', 'public');
    if (error2) {
      console.error("Alternative failed:", error2);
    } else {
      console.log("Tables in public schema:", data2);
    }
  } else {
    console.log("Tables:", data);
  }
}

listTables();
