import express from "express";
import { createServer as createViteServer } from "vite";
import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

// Force development mode if not explicitly set to production
if (process.env.NODE_ENV !== "production") {
  process.env.NODE_ENV = "development";
}

const resend = new Resend(process.env.RESEND_API_KEY);

async function startServer() {
  const app = express();
  const PORT = 3000;
  console.log("NODE_ENV:", process.env.NODE_ENV);

  app.use(express.json());

  // API Route: Send Email
  app.post("/api/send-email", async (req, res) => {
    const { to, subject, html, attachments } = req.body;

    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({ error: "RESEND_API_KEY is not configured" });
    }

    try {
      const { data, error } = await resend.emails.send({
        from: "HR Visibel <onboarding@resend.dev>", // Default Resend test domain
        to,
        subject,
        html,
        attachments: attachments || [],
      });

      if (error) {
        return res.status(400).json({ error });
      }

      res.status(200).json({ data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting Vite in middleware mode...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite middleware attached.");
  } else {
    // Serve static files in production
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
