
import axios from 'axios';

async function setupWebhook() {
  try {
    const res = await axios.get('http://localhost:3000/api/waha/setup-webhook');
    console.log("Setup Webhook Result:", res.data);
  } catch (err: any) {
    console.error("Setup Webhook FAILED:", err.response?.data || err.message);
  }
}

setupWebhook();
