import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import multer from 'multer';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 } // 20 MB limit for inlineData
  });

  // Extract text from the uploaded document to make it searchable/askable by AI
  app.post('/api/extract-text', upload.single('file'), async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      if (!process.env.GEMINI_API_KEY) {
        console.warn('No GEMINI_API_KEY found, skipping text extraction');
        return res.json({ text: '' });
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  data: file.buffer.toString('base64'),
                  mimeType: file.mimetype,
                }
              },
              { text: 'You are helping to index a document for a public circulars portal. Please extract all the meaningful text from this document. Do not include introductory remarks, just output the pure content. If it is an image or video, describe it in detail.' }
            ]
          }
        ]
      });

      res.json({ text: response.text || '' });
    } catch (e: any) {
      console.error('Error extracting text:', e);
      // We don't fail the whole user flow just because extraction failed
      res.json({ text: '' });
    }
  });

  // Chat endpoint
  app.post('/api/chat', async (req, res) => {
    try {
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: 'Gemini API Key is not configured on the server.' });
      }
      const { messages, context } = req.body;
      
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const systemInstruction = `You are a helpful AI assistant for the India Post Dhenkanal Postal Division.
Use the provided circulars and updates context to answer the user's questions accurately.
If you cannot answer the question using the provided context, state that you do not have enough information. Do not guess.

<circular_context>
${context}
</circular_context>
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: messages,
        config: {
          systemInstruction: systemInstruction,
        }
      });
      res.json({ text: response.text });
    } catch (e: any) {
      console.error('Error generating chat:', e);
      res.status(500).json({ error: e.message || 'Failed to generate response' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
