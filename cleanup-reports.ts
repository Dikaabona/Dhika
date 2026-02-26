
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NjEyODYsImV4cCI6MjA4NTIzNzI4Nn0.Ca9m25c9K0_J_kCRphGSaECGs8CGz4-zUpVoA_rIERA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function cleanup() {
  console.log("Starting cleanup...");
  const { data: allReports, error } = await supabase.from('live_reports').select('id, roomId, gmv, tanggal');
  if (error) {
    console.error(error);
    return;
  }

  console.log(`Total reports: ${allReports.length}`);

  const map = new Map();
  const toDelete: string[] = [];

  allReports.forEach(r => {
    const key = `${r.roomId}_${r.tanggal}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, r);
    } else {
      if (r.gmv > existing.gmv) {
        toDelete.push(existing.id);
        map.set(key, r);
      } else {
        toDelete.push(r.id);
      }
    }
  });

  console.log(`Found ${toDelete.length} duplicates to delete.`);

  if (toDelete.length > 0) {
    // Delete in chunks of 50
    for (let i = 0; i < toDelete.length; i += 50) {
      const chunk = toDelete.slice(i, i + 50);
      const { error: delError } = await supabase.from('live_reports').delete().in('id', chunk);
      if (delError) {
        console.error(`Error deleting chunk ${i}:`, delError);
      } else {
        console.log(`Deleted chunk ${i/50 + 1}`);
      }
    }
  }
  console.log("Cleanup finished.");
}

cleanup();
