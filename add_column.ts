import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY2MTI4NiwiZXhwIjoyMDg1MjM3Mjg2fQ.cyX8hoZWpbZ1V8qAPUwoLAHE-mlftuhOuI1x7x8KYk0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function addColumn() {
  console.log('--- Attempting to add sisaCuti column ---');
  const { error } = await supabase.rpc('exec_sql', { 
    sql: 'ALTER TABLE employees ADD COLUMN IF NOT EXISTS "sisaCuti" INTEGER DEFAULT 12;' 
  });

  if (error) {
    console.error('Error adding column via exec_sql:', error);
    
    console.log('Trying another common RPC name: run_sql');
    const { error: error2 } = await supabase.rpc('run_sql', { 
      sql: 'ALTER TABLE employees ADD COLUMN IF NOT EXISTS "sisaCuti" INTEGER DEFAULT 12;' 
    });
    
    if (error2) {
      console.error('Error adding column via run_sql:', error2);
    } else {
      console.log('Successfully added column via run_sql');
    }
  } else {
    console.log('Successfully added column via exec_sql');
  }
}

addColumn();
