import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRules() {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'waha_autoreply_rules_VISIBEL')
    .single();

  if (error) {
    console.error('Error fetching rules:', error);
    return;
  }

  const rules = data.value;
  console.log('Auto-reply rules for VISIBEL:');
  if (Array.isArray(rules)) {
    rules.forEach((rule: any) => {
      console.log(`- ID: ${rule.id}`);
      console.log(`  Keyword: "${rule.keyword}" (length: ${rule.keyword?.length})`);
      if (rule.keyword) {
        console.log(`  Char codes: ${Array.from(rule.keyword).map((c: any) => c.charCodeAt(0)).join(', ')}`);
      }
      console.log(`  MatchType: ${rule.matchType}`);
      console.log(`  Response: ${rule.response}`);
    });
  } else {
    console.log('No rules found or value is not an array.');
  }
}

checkRules();
