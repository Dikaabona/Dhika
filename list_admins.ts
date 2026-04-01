
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NjEyODYsImV4cCI6MjA4NTIzNzI4Nn0.Ca9m25c9K0_J_kCRphGSaECGs8CGz4-zUpVoA_rIERA';
const supabase = createClient(supabaseUrl, supabaseKey);

async function listAdmins() {
  const { data, error } = await supabase
    .from('employees')
    .select('nama, role, email')
    .in('role', ['admin', 'owner', 'super']);

  if (error) {
    console.error('Error fetching admins:', error);
    return;
  }

  console.log('Employees with Admin/Owner/Super roles:');
  console.log(JSON.stringify(data, null, 2));
}

listAdmins();
