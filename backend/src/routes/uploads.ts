import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(__dirname, '../../uploads');

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

export const uploadRoutes = express.Router();

// Upload image (receives base64 data)
uploadRoutes.post('/', async (req, res) => {
  try {
    const { image, filename } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    // Extract base64 data (handle data:image/xxx;base64,... format)
    const matches = image.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ error: 'Invalid image data format. Expected base64 data URL.' });
    }

    const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    // Generate unique filename
    const uniqueName = `${uuidv4()}.${extension}`;
    const filePath = path.join(uploadsDir, uniqueName);

    // Write file
    fs.writeFileSync(filePath, buffer);

    // Return the URL path
    const imageUrl = `/uploads/${uniqueName}`;
    res.status(201).json({ imageUrl, filename: uniqueName });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Delete image
uploadRoutes.post('/delete', async (req, res) => {
  try {
    const { imageUrl } = req.body;
    if (!imageUrl) {
      return res.status(400).json({ error: 'No imageUrl provided' });
    }

    const filename = path.basename(imageUrl);
    const filePath = path.join(uploadsDir, filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({ message: 'Image deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
