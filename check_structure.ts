
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTableStructure() {
  console.log('Checking shift_assignments structure...');
  
  // Try to get column info via a query that returns no rows but gives metadata if possible
  // Or just try to select one row and see the keys
  const { data, error } = await supabase.from('shift_assignments').select('*').limit(1);
  
  if (error) {
    console.error('Error selecting from shift_assignments:', error);
  } else {
    console.log('Sample record (if any):', data);
    if (data && data.length > 0) {
      console.log('Columns:', Object.keys(data[0]));
    } else {
      console.log('Table is empty, cannot infer columns from data.');
    }
  }

  // Try to check if there are any records at all without filters
  const { count, error: countError } = await supabase.from('shift_assignments').select('*', { count: 'exact', head: true });
  console.log('Total count in shift_assignments:', count);

  // Check schedules table too
  const { count: scheduleCount } = await supabase.from('schedules').select('*', { count: 'exact', head: true });
  console.log('Total count in schedules:', scheduleCount);
}

checkTableStructure();
