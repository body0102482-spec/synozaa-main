import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { synthesizeSpeech } from '../services/ttsService.js';

const router = Router();

router.use(authenticate);

router.post('/speak', async (req, res) => {
  try {
    const { text, lang = 'ar-EG' } = req.body as { text?: string; lang?: string };
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'No text provided' });
    }

    const audio = await synthesizeSpeech(text, lang);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.send(audio);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'TTS failed';
    if (message === 'tts-unavailable') {
      return res.status(503).json({ error: 'Text-to-speech is not configured on the server' });
    }
    if (message === 'empty-text') {
      return res.status(400).json({ error: 'Empty text' });
    }
    console.error('TTS error:', err);
    res.status(500).json({ error: 'Text-to-speech failed' });
  }
});

export default router;
