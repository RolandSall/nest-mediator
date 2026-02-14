import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync } from 'fs';

async function bootstrap() {
  const logger = new Logger('MediatorFlowServer');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors();

  // Serve static UI files with SPA fallback
  const uiPath = join(__dirname, '..', 'ui', 'dist');
  if (existsSync(uiPath)) {
    const express = require('express');
    app.use(express.static(uiPath));
    // SPA fallback: serve index.html for any route not matching /api or /collect
    app.use((req: any, res: any, next: any) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/collect')) {
        return next();
      }
      res.sendFile(join(uiPath, 'index.html'));
    });
    logger.log(`Serving UI from ${uiPath}`);
  } else {
    logger.warn(`UI directory not found at ${uiPath} - skipping static file serving`);
  }

  const port = process.env.PORT ?? 4800;
  await app.listen(port);
  logger.log(`MediatorFlow server running on http://localhost:${port}`);
}

bootstrap();
