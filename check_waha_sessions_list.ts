
import axios from "axios";

const apiUrl = "https://waha-e1fqkhd0cijw.cgk-super.sumopod.my.id";
const apiKey = "kDx7DDRlTic6RGfZ5nAaKjpQml6MFLBb";

async function check() {
  try {
    const response = await axios.get(`${apiUrl}/api/sessions`, {
      headers: { 'X-Api-Key': apiKey }
    });
    console.log("Sessions:", JSON.stringify(response.data));
  } catch (err: any) {
    console.error("Error checking WAHA sessions:", err.response?.data || err.message);
  }
}

check();
