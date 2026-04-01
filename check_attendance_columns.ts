
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NjEyODYsImV4cCI6MjA4NTIzNzI4Nn0.Ca9m25c9K0_J_kCRphGSaECGs8CGz4-zUpVoA_rIERA';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAttendanceColumns() {
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching attendance:', error);
  } else {
    console.log('Attendance table columns:', Object.keys(data[0] || {}));
  }
}

checkAttendanceColumns();
