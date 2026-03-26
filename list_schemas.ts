
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function listSchemas() {
  console.log('Listing schemas...');
  // This might not work if permissions are restricted, but let's try
  const { data, error } = await supabase.rpc('get_schemas');
  if (error) {
    console.error('Error calling get_schemas:', error);
    // Fallback: try to query information_schema if possible
    const { data: infoData, error: infoError } = await supabase.from('information_schema.schemata').select('schema_name');
    if (infoError) {
      console.error('Error querying information_schema.schemata:', infoError);
    } else {
      console.log('Schemas from information_schema:', infoData);
    }
  } else {
    console.log('Schemas from RPC:', data);
  }
}

listSchemas();
