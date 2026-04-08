
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY2MTI4NiwiZXhwIjoyMDg1MjM3Mjg2fQ.cyX8hoZWpbZ1V8qAPUwoLAHE-mlftuhOuI1x7x8KYk0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'waha_debug_logs')
    .single();
  
  if (error) {
    console.error(error);
    return;
  }
  
  const logs = data.value || [];
  console.log("Message Error Logs:");
  logs.filter((l: any) => l.type === 'MESSAGE_ERROR').forEach((log: any) => {
    console.log(`[${log.timestamp}] ${log.type}:`, JSON.stringify(log.data));
  });

  console.log("\nMessage Sent Logs:");
  logs.filter((l: any) => l.type === 'MESSAGE_SENT').forEach((log: any) => {
    console.log(`[${log.timestamp}] ${log.type}:`, JSON.stringify(log.data));
  });
  
  console.log("\nRecent logs (last 50):");
  logs.slice(0, 50).forEach((log: any) => {
    console.log(`[${log.timestamp}] ${log.type}:`, JSON.stringify(log.data));
  });
}

check();
