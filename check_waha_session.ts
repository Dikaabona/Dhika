
import axios from "axios";

const apiUrl = "https://waha-e1fqkhd0cijw.cgk-super.sumopod.my.id";
const apiKey = "kDx7DDRlTic6RGfZ5nAaKjpQml6MFLBb";
const sessionName = "Dhika-WAHA";

async function check() {
  try {
    const response = await axios.get(`${apiUrl}/api/sessions/${sessionName}`, {
      headers: { 'X-Api-Key': apiKey }
    });
    console.log("Session status:", response.data.status);
    console.log("Session config:", JSON.stringify(response.data.config));
  } catch (err: any) {
    console.error("Error checking WAHA session:", err.response?.data || err.message);
  }
}

check();
