
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

async function checkSisaCuti() {
  const { data, error } = await supabase
    .from('employees')
    .select('id, nama, sisaCuti')
    .is('deleted_at', null);

  if (error) {
    console.error(error);
    return;
  }

  console.log('Current Sisa Cuti values:');
  data.forEach(emp => {
    console.log(`${emp.nama}: ${emp.sisaCuti}`);
  });
}

checkSisaCuti();
