import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEmployeeColumns() {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching employee:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('Employee columns:', Object.keys(data[0]));
    console.log('Sample employee data:', data[0]);
  } else {
    console.log('No employees found.');
  }
}

checkEmployeeColumns();
