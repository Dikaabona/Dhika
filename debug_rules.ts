
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY2MTI4NiwiZXhwIjoyMDg1MjM3Mjg2fQ.cyX8hoZWpbZ1V8qAPUwoLAHE-mlftuhOuI1x7x8KYk0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkLogs() {
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'waha_debug_logs')
    .single();
  
  const logs = data?.value || [];
  console.log(`Total logs: ${logs.length}`);
  
  const ruleLogs = logs.filter((l: any) => l.type.startsWith('RULE_') || l.type === 'WEBHOOK_PROCESS_CLIENT' || l.type === 'WEBHOOK_PROCESS_EMPLOYEE');
  
  console.log("Rule related logs:");
  ruleLogs.slice(0, 50).forEach((l: any) => {
    console.log(`[${l.timestamp}] ${l.type}: ${JSON.stringify(l.data)}`);
  });
}

checkLogs();
