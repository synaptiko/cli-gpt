import { AssistantCallingFunctionRole, AssistantRole, FunctionResultRole, Message, SystemRole, UserRole } from './ConversationPersistance.ts';
import { Config } from './loadConfig.ts';

type ChatMessage = {
  role: 'user' | 'system' | 'assistant';
  content: string;
} | {
  role: 'assistant';
  functionCall: {
    name: string;
    arguments: string;
  }
} | {
  role: 'function';
  name: string;
  content: string;
};

export type FunctionCall = {
  name: string;
  arguments: string[];
};

export type ContentChunkResponse = {
  content: string;
};

export type FunctionCallResponse = {
  functionCall: {
    name: string;
    arguments: string;
  }
};

export type ChatCompletionChunkedResponse = ContentChunkResponse | FunctionCallResponse;

export function isContent(response: ChatCompletionChunkedResponse): response is { content: string } {
  return 'content' in response;
}

export function isFunctionCall(response: ChatCompletionChunkedResponse): response is FunctionCallResponse {
  return 'functionCall' in response && 'name' in response.functionCall && 'arguments' in response.functionCall;
}

function normalizeMessages(messages: Message[]): ChatMessage[] {
  return messages.reduce<ChatMessage[]>((result, message) => {
    if (message.role === UserRole || message.role === SystemRole || message.role === AssistantRole) {
      const { role: { description: role }, content } = message;
      const previousMessage = result[result.length - 1];

      if (previousMessage?.role === role && 'content' in previousMessage) {
        previousMessage.content += `\n\n${content}`;
      } else if (role === 'user' || role === 'system' || role === 'assistant') {
        result.push({ role, content });
      }
    } else if (message.role === AssistantCallingFunctionRole) {
      const { name, arguments: args } = message;

      result.push({ role: 'assistant', functionCall: { name, arguments: args } });
    } else if (message.role === FunctionResultRole) {
      const { name, content } = message;

      result.push({ role: 'function', name, content });
    }

    return result;
  }, []);
}

export type FunctionDefinition = {
  name: string;
  description?: string;
  parameters: JSONSchemaObject;
};

type JSONSchemaObject = {
  type: 'object',
  description?: string;
  properties: {
    [key: string]: JSONSchemaProperty;
  };
  required?: string[];
};

type JSONSchemaProperty = {
  type: 'string';
  description?: string;
  enum?: string[];
} | {
  type: 'number' | 'integer';
  description?: string;
  enum?: number[];
} | {
  type: 'boolean';
  description?: string;
} | {
  type: 'object';
  description?: string;
  properties: {
    [key: string]: JSONSchemaProperty;
  };
  required?: string[];
} | {
  type: 'array' | 'null';
  description?: string;
};

export class ChatCompletion {
  private config: Config;
  private messages: Message[] = [];
  private functions?: FunctionDefinition[];
  private finished = false;

  constructor(config: Config) {
    this.config = config;
  }

  setFunctions(functions?: FunctionDefinition[]) {
    this.functions = functions;
  }

  setMessages(messages: Message[]) {
    this.messages = messages;
  }

  addMessage(message: Message) {
    this.messages.push(message);
  }

  get isFinished() {
    return this.finished;
  }

  async *complete(abortSignal: AbortSignal): AsyncGenerator<ChatCompletionChunkedResponse> {
    this.finished = false;

    const { functions, messages, config: { api_key, model: { id: model, ...modelConfig } } } = this;
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${api_key}`,
      },
      body: JSON.stringify({
        model,
        ...modelConfig,
        functions,
        function_call: functions ? 'auto' : undefined,
        messages: normalizeMessages(messages),
        stream: true,
      }),
      signal: abortSignal,
    });
    const decoder = new TextDecoder();
    let functionCall: undefined | FunctionCall = undefined;

    if (!response.ok || response.body === null) {
      try {
        console.error('Response error:', await response.json());
      } catch (_ignore) { /* ignore */ }
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
            const { delta, finish_reason: finishReason } = message.choices[0];
            const { content, function_call: functionCallChunk } = delta;

            this.finished = finishReason === 'stop';

            if (typeof content === 'string') {
              yield { content };
            }

            if (functionCallChunk) {
              if ('name' in functionCallChunk) {
                functionCall = {
                  name: functionCallChunk.name,
                  arguments: [functionCallChunk.arguments],
                };
              } else if ('arguments' in functionCallChunk && functionCall) {
                functionCall.arguments.push(functionCallChunk.arguments);
              }
            }

            if (finishReason === 'function_call' && functionCall) {
              yield {
                functionCall: {
                  name: functionCall.name,
                  arguments: functionCall.arguments.join(''),
                }
              };
            }
          }
        }
      }
    }
  }
}
