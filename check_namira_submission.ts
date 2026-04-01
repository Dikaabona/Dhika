
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NjEyODYsImV4cCI6MjA4NTIzNzI4Nn0.Ca9m25c9K0_J_kCRphGSaECGs8CGz4-zUpVoA_rIERA';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSubmission() {
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .ilike('employeeName', '%Namira Shifa Nurfadilah%')
    .order('submittedAt', { ascending: false });

  if (error) {
    console.error('Error fetching submissions:', error);
    return;
  }

  console.log('Submissions for Namira Shifa Nurfadilah:');
  console.log(JSON.stringify(data, null, 2));
}

checkSubmission();
