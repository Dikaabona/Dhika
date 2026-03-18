
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NjEyODYsImV4cCI6MjA4NTIzNzI4Nn0.Ca9m25c9K0_J_kCRphGSaECGs8CGz4-zUpVoA_rIERA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testFinal() {
  console.log("--- TESTING WAHA CONNECTION WITH NEW KEY ---");
  
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'waha_settings_Visibel')
    .single();

  if (!data) {
    console.error("Settings not found in DB");
    return;
  }

  const { apiUrl, apiKey, sessionName } = data.value;
  console.log(`Using API URL: ${apiUrl}`);
  console.log(`Using Session: ${sessionName}`);
  console.log(`API Key Length: ${apiKey?.length || 0}`);

  // Clean URL
  let cleanUrl = apiUrl;
  if (cleanUrl.endsWith('/dashboard')) cleanUrl = cleanUrl.replace('/dashboard', '');
  if (cleanUrl.endsWith('/')) cleanUrl = cleanUrl.slice(0, -1);

  try {
    const res = await axios.post(`${cleanUrl}/api/sendText`, {
      chatId: '628111624080@c.us',
      text: "Halo! Ini adalah tes otomatis dari sistem Majova.id. Jika Anda menerima ini, berarti API Key sudah BENAR. ✅",
      session: sessionName
    }, {
      headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' }
    });
    console.log("SUCCESS!", res.data);
  } catch (err: any) {
    console.error("FAILED!", err.response?.data || err.message);
  }
}

testFinal();
