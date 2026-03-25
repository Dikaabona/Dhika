
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NjEyODYsImV4cCI6MjA4NTIzNzI4Nn0.Ca9m25c9K0_J_kCRphGSaECGs8CGz4-zUpVoA_rIERA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkSchemas() {
  const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'employees' });
  if (error) {
    console.error('RPC Error:', error.message);
    // Try another way
    const { data: data2, error: error2 } = await supabase.from('employees').select('*').limit(1);
    if (data2) {
       console.log('Keys from select *:', Object.keys(data2[0]));
    }
  } else {
    console.log('Columns from RPC:', data);
  }
}

checkSchemas();
