import axios from 'axios';

const apiUrl = 'https://waha-e1fqkhd0cijw.cgk-super.sumopod.my.id';
const apiKey = 'kDx7DDRlTic6RGfZ5nAaKjpQml6MFLBb';
const sessionName = 'Dhika-WAHA';

async function checkWaha() {
  try {
    console.log(`Checking session ${sessionName}...`);
    const sessionRes = await axios.get(`${apiUrl}/api/sessions/${sessionName}`, {
      headers: { 'X-Api-Key': apiKey }
    });
    console.log("Session Status:", sessionRes.data.status);
    console.log("Session Config:", JSON.stringify(sessionRes.data.config, null, 2));

    console.log("\nChecking Webhooks...");
    const webhooksRes = await axios.get(`${apiUrl}/api/webhooks`, {
      headers: { 'X-Api-Key': apiKey }
    });
    console.log("Webhooks:", JSON.stringify(webhooksRes.data, null, 2));
  } catch (err) {
    console.error("Error:", err.response?.status, err.response?.data || err.message);
  }
}
checkWaha();
