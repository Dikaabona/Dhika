
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkShiftAssignments() {
  console.log('Checking shift_assignments...');
  const { data, error, count } = await supabase
    .from('shift_assignments')
    .select('*', { count: 'exact' });

  if (error) {
    console.error('Error:', error);
  } else {
    console.log(`Total records in shift_assignments: ${count}`);
    if (data && data.length > 0) {
      console.log('Sample records:');
      data.slice(0, 5).forEach(r => console.log(r));
    }
  }

  console.log('Checking schedules...');
  const { data: schedData, error: schedError, count: schedCount } = await supabase
    .from('schedules')
    .select('*', { count: 'exact' });

  if (schedError) {
    console.error('Error:', schedError);
  } else {
    console.log(`Total records in schedules: ${schedCount}`);
    if (schedData && schedData.length > 0) {
      console.log('Sample records:');
      schedData.slice(0, 5).forEach(r => console.log(r));
    }
  }
}

checkShiftAssignments();
