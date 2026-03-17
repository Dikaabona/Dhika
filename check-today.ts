
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NjEyODYsImV4cCI6MjA4NTIzNzI4Nn0.Ca9m25c9K0_J_kCRphGSaECGs8CGz4-zUpVoA_rIERA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
  const today = '2026-03-17';
  const { data: schedules, error } = await supabase.from('schedules').select('*').eq('date', today);
  console.log("Schedules for today:", schedules);
  if (error) console.error(error);

  const { data: assignments, error2 } = await supabase.from('shift_assignments').select('*').eq('date', today);
  console.log("Assignments for today:", assignments);
  if (error2) console.error(error2);
}

check();
