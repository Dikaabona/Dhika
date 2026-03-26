import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NjEyODYsImV4cCI6MjA4NTIzNzI4Nn0.Ca9m25c9K0_J_kCRphGSaECGs8CGz4-zUpVoA_rIERA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkAssignments() {
  const today = new Date().toISOString().split('T')[0];
  console.log('Checking assignments for:', today);

  const { data: assignments, error: assignError } = await supabase
    .from('shift_assignments')
    .select('*')
    .eq('date', today);

  if (assignError) {
    console.error('Error fetching assignments:', assignError);
    return;
  }

  console.log(`Found ${assignments.length} assignments for today.`);
  
  const { data: emps } = await supabase.from('employees').select('id, nama');
  
  assignments.forEach(a => {
    const emp = emps?.find(e => e.id === a.employeeId);
    console.log(`- ${emp?.nama || 'Unknown'}: Shift ID ${a.shiftId}`);
  });
}

checkAssignments();
