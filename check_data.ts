import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NjEyODYsImV4cCI6MjA4NTIzNzI4Nn0.Ca9m25c9K0_J_kCRphGSaECGs8CGz4-zUpVoA_rIERA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkData() {
  console.log('Checking content_plans schema and data...');
  const { data: schemaData, error: schemaError } = await supabase
    .from('content_plans')
    .select('*')
    .limit(1);

  if (schemaError) {
    console.error('Error fetching schema:', schemaError);
    return;
  }

  if (schemaData.length > 0) {
    console.log('Available columns:', Object.keys(schemaData[0]));
  } else {
    console.log('No records found in content_plans.');
    return;
  }

  // Try to find columns that match the screenshot
  const columns = Object.keys(schemaData[0]);
  const dateCol = columns.find(c => c.toLowerCase().includes('tanggal') || c.toLowerCase().includes('date'));
  const companyCol = columns.find(c => c.toLowerCase().includes('company'));
  const brandCol = columns.find(c => c.toLowerCase().includes('brand'));

  console.log(`Using columns: date=${dateCol}, company=${companyCol}, brand=${brandCol}`);

  const { data, error } = await supabase
    .from('content_plans')
    .select('*')
    .eq(companyCol || 'company', 'Visibel')
    .eq(brandCol || 'brand', 'NAMASKARA');

  if (error) {
    console.error('Error fetching data:', error);
    return;
  }

  console.log(`Found ${data.length} records for Visibel NAMASKARA.`);
  data.forEach(r => {
    console.log(`- ${r.postingDate}: ${r.linkPostingan}`);
  });
}

checkData();
