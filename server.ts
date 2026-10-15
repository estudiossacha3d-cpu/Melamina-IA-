import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API to save warehouse items into defaultFurniture.ts
  app.post('/api/save-default-warehouse', (req, res) => {
    try {
      const { catalog, categories } = req.body;
      if (!Array.isArray(catalog)) {
        return res.status(400).json({ error: 'Catalog must be an array' });
      }

      const cats = Array.isArray(categories) && categories.length > 0
        ? categories
        : ['Todas', 'Cocina', 'Dormitorio', 'Sala y TV', 'Oficina y Estudio', 'Baño'];

      const fileContent = `import { DynamicFurnitureItem } from '../types';\n\nexport const DEFAULT_FURNITURE_CATEGORIES = ${JSON.stringify(cats, null, 2)};\n\nexport const DEFAULT_FURNITURE_CATALOG: DynamicFurnitureItem[] = ${JSON.stringify(catalog, null, 2)};\n`;

      const filePath = path.resolve(process.cwd(), 'src/data/defaultFurniture.ts');
      fs.writeFileSync(filePath, fileContent, 'utf-8');

      console.log(`[Warehouse] Successfully saved ${catalog.length} items to defaultFurniture.ts`);
      return res.json({ success: true, count: catalog.length });
    } catch (err: any) {
      console.error('[Warehouse] Error saving default furniture:', err);
      return res.status(500).json({ error: err.message || 'Error saving file' });
    }
  });

  // API to read current default furniture
  app.get('/api/default-warehouse', (req, res) => {
    try {
      const filePath = path.resolve(process.cwd(), 'src/data/defaultFurniture.ts');
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        return res.json({ success: true, raw: content });
      }
      return res.json({ success: false, message: 'File not found' });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware in dev mode
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist/index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
