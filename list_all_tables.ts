
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function listAllTables() {
  console.log('Listing all tables from pg_catalog...');
  // This might fail if permissions are restricted, but let's try
  const { data, error } = await supabase.from('pg_catalog.pg_tables').select('schemaname, tablename');
  if (error) {
    console.error('Error querying pg_catalog.pg_tables:', error);
  } else {
    console.log('Tables found:', data);
  }
}

listAllTables();
