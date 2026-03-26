import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCounts() {
  const { count: shiftCount, error: shiftError } = await supabase
    .from('shift_assignments')
    .select('*', { count: 'exact', head: true });

  const { count: scheduleCount, error: scheduleError } = await supabase
    .from('schedules')
    .select('*', { count: 'exact', head: true });

  console.log('Shift Assignments Count:', shiftCount);
  console.log('Schedules Count:', scheduleCount);
  
  if (shiftError) console.error('Shift Error:', shiftError);
  if (scheduleError) console.error('Schedule Error:', scheduleError);
}

checkCounts();
