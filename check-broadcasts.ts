import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

async function check() {
  try {
    const { data: broadcasts, error } = await supabase
      .from('broadcasts')
      .select('*')
      .contains('targetEmployeeIds', ['9ff5ea28-ddd0-4bde-89ba-f054d531d173'])
      .order('sentAt', { ascending: false })
      .limit(5);
    
    if (error) {
      console.error("Error fetching broadcasts:", error);
    } else {
      console.log("Latest Broadcasts:", broadcasts.map(b => ({
        id: b.id,
        title: b.title,
        sentAt: b.sentAt,
        targetEmployeeIds: b.targetEmployeeIds,
        hasImage: !!b.imageBase64
      })));
    }
  } catch (err) {
    console.error("Unexpected error:", err);
  }
}

check();
