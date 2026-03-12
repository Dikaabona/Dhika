import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const WAHA_URL = "https://waha-e1fqkhd0cijw.cgk-super.sumopod.my.id";
const WAHA_API_KEY = "kDx7DDRlTic6RGfZ5nAaKjpQml6MFLBb";
const SESSION = "Dhika-WAHA";

app.post("/api/webhook/waha", async (req, res) => {
  try {
    const data = req.body;

    console.log("Webhook received:", data);

    if (data.event === "message") {

      const from = data.payload.from;
      const text = data.payload.body;

      console.log("Message from:", from);
      console.log("Text:", text);

      let reply = "Halo kak 👋 Pesan sudah diterima oleh Visibel Agency.";

      if (text === "!jadwal") {
        reply = "Jadwal live Visibel minggu ini:\nSenin - Jumat\n19.00 - 23.00 WIB";
      }

      if (text === "!layanan") {
        reply = "Visibel menyediakan:\n• Live Streaming\n• Short Video\n• TikTok Ads\n• Social Media Management";
      }

      await fetch(`${WAHA_URL}/api/sendText`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": WAHA_API_KEY
        },
        body: JSON.stringify({
          session: SESSION,
          chatId: from,
          text: reply
        })
      });
    }

    res.status(200).json({ status: "ok" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "server error" });
  }
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
