
import axios from 'axios';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
dotenv.config();

async function testSend() {
  const SUPABASE_URL = 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NjEyODYsImV4cCI6MjA4NTIzNzI4Nn0.Ca9m25c9K0_J_kCRphGSaECGs8CGz4-zUpVoA_rIERA';
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const company = 'Visibel';
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', `waha_settings_${company}`)
    .single();

  const settings = data?.value as any;
  const apiUrl = process.env.WAHA_API_URL || settings?.apiUrl;
  const apiKey = process.env.WAHA_API_KEY || settings?.apiKey;
  const sessionName = process.env.WAHA_SESSION_NAME || settings?.sessionName || 'default';
  const to = '628111624080@c.us';

  console.log(`Testing send to ${to}`);
  console.log(`API URL: ${apiUrl}`);
  console.log(`API Key: ${apiKey ? 'SET' : 'NOT SET'}`);
  console.log(`Session: ${sessionName}`);
  console.log(`Source: ${process.env.WAHA_API_URL ? 'ENV' : 'SUPABASE'}`);

  if (!apiUrl) {
    console.error("WAHA_API_URL is not set.");
    return;
  }

  try {
    const response = await axios.post(`${apiUrl}/api/sendText`, {
      chatId: to,
      text: "Test message from Majova.id Backend",
      session: sessionName
    }, {
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json'
      }
    });
    console.log("Response:", response.data);
  } catch (err: any) {
    console.error("Error:", err.response?.data || err.message);
  }
}

testSend();
