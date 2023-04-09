import { Message } from './ConversationPersistance.ts';
import { Config } from './loadConfig.ts';

function normalizeMessages(messages: Message[]): Message[] {
  return messages.reduce<Message[]>((result, message) => {
    if (result[result.length - 1]?.role === message.role) {
      result[result.length - 1].content += `\n\n${message.content}`;
    } else {
      result.push({ ...message });
    }

    return result;
  }, []);
}

export class ChatCompletion {
  private config: Config;
  private messages: Message[] = [];

  constructor(config: Config) {
    this.config = config;
  }

  setMessages(messages: Message[]) {
    this.messages = messages;
  }

  async *complete(): AsyncGenerator<string> {
    const { config: { api_key, ...config } } = this;
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${api_key}`,
      },
      body: JSON.stringify({
        ...config,
        messages: normalizeMessages(this.messages),
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
