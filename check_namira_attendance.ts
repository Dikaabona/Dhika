
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NjEyODYsImV4cCI6MjA4NTIzNzI4Nn0.Ca9m25c9K0_J_kCRphGSaECGs8CGz4-zUpVoA_rIERA';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAttendance() {
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('employeeId', '7cfded4a-f509-4182-bcc3-a315371906e8')
    .eq('date', '2026-04-01');

  if (error) {
    console.error('Error fetching attendance:', error);
    return;
  }

  console.log('Attendance for Namira Shifa Nurfadilah on 2026-04-01:');
  console.log(JSON.stringify(data, null, 2));
}

checkAttendance();
