import { Controller, Post, Body, Res, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';

@Controller('api/ai')
export class AiProxyController {

  @Post('openai/chat')
  async proxyOpenAI(
    @Body() body: { apiKey: string; model: string; messages: any[]; tools?: any[]; stream?: boolean },
    @Res() res: Response,
  ) {
    const { apiKey, model, messages, tools, stream } = body;

    if (!apiKey) {
      throw new HttpException('API key is required', HttpStatus.BAD_REQUEST);
    }

    const openaiBody: any = { model, messages, stream: stream ?? true };
    if (tools?.length) {
      openaiBody.tools = tools;
    }

    try {
      const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(openaiBody),
      });

      if (!upstream.ok) {
        const errorText = await upstream.text();
        res.status(upstream.status).send(errorText);
        return;
      }

      if (stream && upstream.body) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const reader = (upstream.body as any).getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
        } finally {
          res.end();
        }
      } else {
        const json = await upstream.json();
        res.json(json);
      }
    } catch (err: any) {
      throw new HttpException(
        err.message ?? 'OpenAI proxy error',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
