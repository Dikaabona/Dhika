import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkCompanies() {
  const { data, error } = await supabase
    .from('content_plans')
    .select('company')
    .limit(100);

  if (error) {
    console.error('Error:', error);
    return;
  }

  const companies = [...new Set(data.map(d => d.company))];
  console.log('Unique companies in content_plans:', companies);
}

checkCompanies();
