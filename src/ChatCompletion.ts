import { Message } from './ConversationPersistance.ts';
import { Config } from './loadConfig.ts';

type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

function normalizeMessages(messages: Message[]): ChatMessage[] {
  return messages.reduce<ChatMessage[]>((result, { role: { description: role }, content }) => {
    if (result[result.length - 1]?.role === role) {
      result[result.length - 1].content += `\n\n${content}`;
    } else {
      result.push({ role: (role as ChatMessage['role']), content });
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

  async *complete(abortSignal: AbortSignal): AsyncGenerator<string> {
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
      signal: abortSignal,
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
