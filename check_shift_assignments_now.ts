
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkShiftAssignments() {
  console.log('Checking shift_assignments for ANY records...');
  const { data, error, count } = await supabase
    .from('shift_assignments')
    .select('*', { count: 'exact' });

  if (error) {
    console.error('Error:', error);
  } else {
    console.log(`Total records in shift_assignments: ${count}`);
    if (data && data.length > 0) {
      console.log('Sample records:');
      data.slice(0, 10).forEach(r => console.log(r));
    } else {
      console.log('STILL EMPTY.');
    }
  }
}

checkShiftAssignments();
