import express from "express";
import { createServer as createViteServer } from "vite";
import { Resend } from "resend";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Initialize Resend safely
let resend: Resend | null = null;
try {
  if (process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
    console.log("Resend initialized with API key");
  } else {
    console.warn("RESEND_API_KEY not found in environment variables");
  }
} catch (e) {
  console.error("Error initializing Resend:", e);
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// API Route to send email
app.post("/api/send-email", async (req, res) => {
  const { to, subject, html, from, attachments } = req.body;
  console.log(`API Request: Send email to ${to}`);

  if (!resend) {
    console.error("Resend client not initialized (missing API key)");
    return res.status(500).json({ error: "Email service not configured (RESEND_API_KEY missing)" });
  }

  try {
    let processedAttachments: any[] = [];
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

    const { data, error } = await resend.emails.send({
      from: from || "admin@visibel.agency",
      to: [to],
      subject: subject,
      html: html,
      attachments: processedAttachments.length > 0 ? processedAttachments : undefined,
    });

    if (error) {
      console.error("Resend API Error:", error);
      return res.status(400).json(error);
    }

    res.status(200).json(data);
  } catch (err: any) {
    console.error("Server Error sending email:", err);
    res.status(500).json({ error: err.message });
  }
});

async function startServer() {
  const PORT = 3000;
  const isProd = process.env.NODE_ENV === "production";

  console.log(`Starting server in ${isProd ? 'production' : 'development'} mode...`);

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      if (url.startsWith('/api') || url.includes('.')) return next();
      
      try {
        let template = fs.readFileSync(path.resolve(__dirname, "index.html"), "utf-8");
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

// Only start the server if not running on Vercel
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  startServer().catch(err => {
    console.error("CRITICAL: Failed to start server:", err);
  });
}

export default app;
