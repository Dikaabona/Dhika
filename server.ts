import express from "express";
import { createServer as createViteServer } from "vite";
import { Resend } from "resend";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const resend = new Resend(process.env.RESEND_API_KEY || 'no-key');

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// API Route to send email
app.post("/api/send-email", async (req, res) => {
  const { to, subject, html, from, attachments } = req.body;
  console.log(`API Request: Send email to ${to}`);

  if (!process.env.RESEND_API_KEY) {
    console.error("Missing RESEND_API_KEY");
    return res.status(500).json({ error: "RESEND_API_KEY is not configured" });
  }

  try {
    console.log("DEBUG: Processing attachments for Resend...");
    
    let processedAttachments = [];
    if (attachments && Array.isArray(attachments)) {
      processedAttachments = attachments.map((att: any) => {
        const contentBuffer = typeof att.content === 'string' 
          ? Buffer.from(att.content, 'base64') 
          : att.content;

        return {
          filename: att.filename || 'attachment.png',
          content: contentBuffer,
          contentType: att.contentType,
          contentId: att.cid || att.contentId
        };
      });
    }

    console.log(`DEBUG: Sending email to ${to} with ${processedAttachments.length} attachments`);
    
    const { data, error } = await resend.emails.send({
      from: from || "admin@visibel.agency",
      to: [to],
      subject: subject,
      html: html,
      attachments: processedAttachments.length > 0 ? processedAttachments : undefined,
    });

    if (error) {
      console.error("Resend Error:", error);
      return res.status(400).json(error);
    }

    res.status(200).json(data);
  } catch (err: any) {
    console.error("Server Error:", err);
    res.status(500).json({ error: err.message });
  }
});

async function startServer() {
  const PORT = 3000;

  console.log("Starting server with NODE_ENV:", process.env.NODE_ENV);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("Initializing Vite in middleware mode...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Serving static files from dist...");
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

// Only start the server if we're not in a serverless environment (like Vercel)
if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  startServer().catch(err => {
    console.error("Failed to start server:", err);
  });
}

export default app;
