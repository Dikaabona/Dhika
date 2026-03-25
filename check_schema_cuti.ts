
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NjEyODYsImV4cCI6MjA4NTIzNzI4Nn0.Ca9m25c9K0_J_kCRphGSaECGs8CGz4-zUpVoA_rIERA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkSchema() {
  const { data: employees, error: empError } = await supabase
    .from('employees')
    .select('*')
    .limit(1);
    
  if (empError) {
    console.error('Employee Error:', empError);
  } else {
    console.log('Employee Sample:', employees[0]);
  }
  
  const { data: submissions, error: subError } = await supabase
    .from('submissions')
    .select('*')
    .limit(1);
    
  if (subError) {
    console.error('Submission Error:', subError);
  } else {
    console.log('Submission Sample:', submissions[0]);
  }
}

checkSchema();
