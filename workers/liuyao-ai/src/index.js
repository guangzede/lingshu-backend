export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Only POST is supported', { status: 405 });
    }

    const url = new URL(request.url);
    if (!url.pathname.endsWith('/chat/completions') && !url.pathname.endsWith('/v1/chat/completions')) {
      return new Response('Invalid endpoint. Use /v1/chat/completions', { status: 404 });
    }

    try {
      const body = await request.json();
      const {
        messages,
        model,
        temperature = 0.6,
        max_tokens = 4096,
        stream = true,
        ...rest
      } = body;

      if (!Array.isArray(messages)) {
        return Response.json(
          { error: { message: 'messages must be an array' } },
          { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
        );
      }

      const cfModel = '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b';

      if (stream) {
        const aiStream = await env.AI.run(cfModel, {
          messages,
          max_tokens,
          temperature,
          stream: true,
          ...rest
        });

        return new Response(
          new ReadableStream({
            async start(controller) {
              const encoder = new TextEncoder();
              const decoder = new TextDecoder();
              let hasContent = false;

              for await (const chunk of aiStream) {
                const chunkStr = decoder.decode(chunk, { stream: true });

                let content = '';
                try {
                  const cleanChunk = chunkStr.startsWith('data: ')
                    ? chunkStr.slice(6)
                    : chunkStr;

                  if (cleanChunk.trim() === '[DONE]') continue;

                  const parsed = JSON.parse(cleanChunk);
                  content = parsed.response || parsed.delta?.content || '';
                } catch {
                  content = chunkStr;
                }

                if (content) {
                  hasContent = true;
                  const chunkData = {
                    id: 'chatcmpl-' + Date.now().toString(36),
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: model || 'deepseek-r1-32b',
                    choices: [
                      {
                        index: 0,
                        delta: { content: content },
                        finish_reason: null
                      }
                    ]
                  };
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify(chunkData)}\n\n`)
                  );
                }
              }

              if (!hasContent) {
                console.log('WARN: no content from model stream');
              }

              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
            }
          }),
          {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              Connection: 'keep-alive',
              'Access-Control-Allow-Origin': '*'
            }
          }
        );
      }

      const aiResult = await env.AI.run(cfModel, {
        messages,
        max_tokens,
        temperature,
        ...rest
      });

      const content = aiResult.response || '';

      return Response.json(
        {
          id: 'chatcmpl-' + Date.now().toString(36),
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: model || 'deepseek-r1-32b',
          choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
          usage: aiResult.usage || {}
        },
        { headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    } catch (error) {
      const message = error?.message || String(error);
      console.error('Worker Error:', message, error?.stack || '');
      return Response.json(
        { error: { message } },
        { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }
  }
};
