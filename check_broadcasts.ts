
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NjEyODYsImV4cCI6MjA4NTIzNzI4Nn0.Ca9m25c9K0_J_kCRphGSaECGs8CGz4-zUpVoA_rIERA';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBroadcasts() {
  const { data, error } = await supabase
    .from('broadcasts')
    .select('*')
    .gte('sentAt', '2026-04-01')
    .order('sentAt', { ascending: false });

  if (error) {
    console.error('Error fetching broadcasts:', error);
    return;
  }

  console.log('Broadcasts on or after 2026-04-01:');
  console.log(JSON.stringify(data, null, 2));
}

checkBroadcasts();
