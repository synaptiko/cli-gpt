export class ChatCompletion {
  private openaiKey: string;
  private model: string;

  constructor(openaiKey: string, model: string = 'gpt-4') {
    this.openaiKey = openaiKey;
    this.model = model;
  }

  async* complete(content: string): AsyncGenerator<string> {
    const { model, openaiKey } = this;
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content }],
        stream: true,
      }),
    });
    const decoder = new TextDecoder();

    if (!response.ok || response.body === null) {
      throw new Error(response.statusText);
    }

    for await (const chunk of response.body) {
      const decodedChunk = decoder.decode(chunk);
      const lines = decodedChunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const payload = line.slice(6);

          if (payload !== '[DONE]') {
            const message = JSON.parse(payload);
            const delta = message.choices[0].delta;
            const { content } = delta;

            if (content !== undefined) {
              yield content;
            }
          }
        }
      }
    }
  }
}
