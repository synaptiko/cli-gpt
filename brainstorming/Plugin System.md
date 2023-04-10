# user:
src/index.ts:
```
/*!
 * cli-gpt
 * Copyright (c) 2023 Jiří Prokop | synaptiko.cz
 * Licensed under the MIT License (https://opensource.org/licenses/MIT)
 */
import { writeText as copyToClipboard } from 'copy_paste/mod.ts';
import { prompt } from './prompt.ts';
import { ChatCompletion } from './ChatCompletion.ts';
import { printHelp } from './printHelp.ts';
import { ConversationPersistance } from './ConversationPersistance.ts';
import { parseArgs } from './parseArgs.ts';
import { loadConfig } from './loadConfig.ts';

const config = await loadConfig();
const conversationPersistance = new ConversationPersistance();
const { flags, role, readFiles, prompt: promptFromArgs } = parseArgs();
const { affectInitialMessages } = flags;

if (flags.help) {
  printHelp();
} else if (flags.reset) {
  conversationPersistance.reset(flags.affectInitialMessages);
} else {
  let content;

  if (readFiles !== undefined) {
    const filesContent = await Promise.all(readFiles.map(async (file) => {
      const fileContent = await Deno.readTextFile(file);
      return `${file}:\n\`\`\`\n${fileContent}\n\`\`\`\n`;
    }));

    content = filesContent.join('\n');
    console.log(content);
  }

  if (flags.multiline || promptFromArgs === undefined) {
    content = (content ?? '') + await prompt(flags.multiline);
    console.log('\nResponse:');
  } else {
    content = promptFromArgs;
  }

  if (!flags.oneShot) {
    conversationPersistance.append({
      role,
      content,
      affectInitialMessages,
    });
  }

  if (role === 'user') {
    const chatCompletion = new ChatCompletion(config);
    const encoder = new TextEncoder();
    const write = (chunk: string) => Deno.stdout.write(encoder.encode(chunk));
    const responseContent = [];

    if (flags.oneShot) {
      chatCompletion.setMessages([{ role: 'user', content }]);
    } else {
      chatCompletion.setMessages(conversationPersistance.getMessages());
    }

    try {
      for await (const chunk of chatCompletion.complete()) {
        responseContent.push(chunk);
        write(chunk);
      }
      write('\n');

      if (flags.copyResponse) {
        copyToClipboard(responseContent.join(''));
      }

      if (!flags.oneShot) {
        conversationPersistance.append({
          role: 'assistant',
          content: responseContent.join(''),
          affectInitialMessages,
        });
      }
    } catch (error) {
      console.error('Error:', error.message);
      Deno.exit(1);
    }
  }
}

```

src/parseArgs.ts:
```
import { Role } from './ConversationPersistance.ts';

export type Params = {
  flags: Flags;
  role: Role;
  readFiles: string[] | undefined;
  prompt: string | undefined;
};

export type Flags = {
  multiline: boolean;
  affectInitialMessages: boolean;
  oneShot: boolean;
  copyResponse: boolean;
  reset: boolean;
  help: boolean;
};

export function parseArgs(): Params {
  const args = [...Deno.args];
  let argsRead = false;
  let role: Role | undefined;
  const params: Omit<Params, 'role'> = {
    readFiles: undefined,
    prompt: undefined,
    flags: {
      multiline: false,
      affectInitialMessages: false,
      oneShot: false,
      copyResponse: false,
      reset: false,
      help: false,
    },
  };

  while (!argsRead) {
    switch (args[0]) {
      case '--user':
      case '-u':
        if (role !== undefined) {
          console.error('Error: Only one role can be specified.');
          Deno.exit(1);
        }
        args.shift();
        role = 'user';
        break;
      case '--assistant':
      case '-a':
        if (role !== undefined) {
          console.error('Error: Only one role can be specified.');
          Deno.exit(1);
        }
        args.shift();
        role = 'assistant';
        break;
      case '--system':
      case '-s':
        if (role !== undefined) {
          console.error('Error: Only one role can be specified.');
          Deno.exit(1);
        }
        args.shift();
        role = 'system';
        break;
      case '--multiline':
      case '-m':
        args.shift();
        params.flags.multiline = true;
        break;
      case '--read':
      case '-r':
        args.shift();
        params.readFiles = [...args];
        args.splice(0, args.length);
        break;
      case '--initial':
      case '-i':
        args.shift();
        params.flags.affectInitialMessages = true;
        break;
      case '--one-shot':
      case '-o':
        args.shift();
        params.flags.oneShot = true;
        break;
      case '--copy':
      case '-c':
        args.shift();
        params.flags.copyResponse = true;
        break;
      case '--reset':
      case '-e': {
        const nextArg = args[1];

        args.shift();

        if (nextArg === '--initial' || nextArg === '-i') {
          args.shift();
          params.flags.affectInitialMessages = true;
        }

        if (args.length !== 0) {
          console.error('Error: --reset can only be standalone or together with --initial.');
          Deno.exit(1);
        }

        params.flags.reset = true;
        argsRead = true;
        break;
      }
      case '--help':
      case '-h':
        if (Deno.args.length !== 1) {
          console.error('Error: --help can only be standalone.');
          Deno.exit(1);
        }
        params.flags.help = true;
        argsRead = true;
        break;
    }

    if (!argsRead) {
      argsRead = args.length === 0 || !args[0].startsWith('-');
    }
  }

  if (args.length !== 0) {
    params.prompt = args.join(' ');
  }

  const result = { ...params, role: role ?? 'user' };

  validateParams(result);

  return result;
}

function validateParams(params: Params): void {
  if ((params.flags.multiline || params.readFiles) && params.prompt !== undefined) {
    console.error('Error: When using --multiline or --read, the prompt must be provided through stdin.');
    Deno.exit(1);
  }

  if (params.flags.affectInitialMessages && params.flags.oneShot) {
    console.error('Error: --initial and --one-shot cannot be used together.');
    Deno.exit(1);
  }

  if (params.role !== 'user' && params.flags.copyResponse) {
    console.error('Error: --copy can only be used with --user.');
    Deno.exit(1);
  }

  validateFilePaths(params.readFiles);
}

function validateFilePaths(filePaths: string[] = []): void {
  filePaths.forEach((file) => {
    try {
      Deno.statSync(file);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        console.error(`Error: File not found: ${file}`);
        Deno.exit(1);
      } else {
        console.error(`Error: Unable to read file: ${file}`);
        Deno.exit(1);
      }
    }
  });
}

```

src/ChatCompletion.ts:
```
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

```

src/ConversationPersistance.ts:
```
const initialMessagesPath = '.cli-gpt.initial.md';
const conversationPath = '.cli-gpt.conversation.md';

export type Role = 'user' | 'assistant' | 'system';
export type Message = { role: Role; content: string };

function readFile(path: string): string | undefined {
  try {
    return Deno.readTextFileSync(path);
  } catch {
    return undefined;
  }
}

function parseMessages(fileContent = ''): Message[] {
  const messages: Message[] = [];
  let role: Role | undefined;
  let content: string[] = [];

  fileContent.split('\n').forEach((line) => {
    if (line !== '') {
      let newRole: Role | undefined;

      switch (line) {
        case '# system:':
          newRole = 'system';
          break;
        case '# assistant:':
          newRole = 'assistant';
          break;
        case '# user:':
          newRole = 'user';
          break;
      }

      if (newRole !== undefined && role !== undefined && content.length > 0) {
        messages.push({ role, content: content.join('\n') });
        content = [];
      }

      if (newRole !== undefined) {
        role = newRole;
      } else {
        content.push(line);
      }
    }
  });

  if (role !== undefined && content.length > 0) {
    messages.push({ role, content: content.join('\n') });
  }

  return messages;
}

export class ConversationPersistance {
  reset(affectInitialMessages: boolean) {
    try {
      if (affectInitialMessages) {
        Deno.removeSync(initialMessagesPath);
      }
      Deno.removeSync(conversationPath);
    } catch {
      // ignore
    }
  }

  append({ role, content, affectInitialMessages }: { role: Role; content: string; affectInitialMessages: boolean }) {
    Deno.writeTextFileSync(
      affectInitialMessages ? initialMessagesPath : conversationPath,
      `# ${role}:\n${content}\n\n`,
      { append: true },
    );
  }

  getMessages(): Message[] {
    const initialMessages = readFile(initialMessagesPath);
    const conversation = readFile(conversationPath);

    return [...parseMessages(initialMessages), ...parseMessages(conversation)];
  }
}

```
On high level, what do we need to do to support plugins in our cli tool? Write down a list of steps/tasks.

The goals and features are:
1. plugin is composed of typescript files which can be present either in user's home directory or in the current directory
2. plugin can read user's or assistance's messages and react on them by either executing specific commands or spawning new instances of cli-gpt tool and instructing it to do specific sub-tasks
3. plugin can have specific system message(s) for spawned cli-gpt sub-processes

Some ideas what it can allow use to do:
- have refactoring tool which automatically applies suggestions from assistant
- have plugin which automatically marks tasks in TODO list as done as it can understand the state of the project based on the converstation
- have a plugin which can provide additional information by browsing web or accessing specific API, e.g. GitHub's API

# assistant:
In order to support plugins in your CLI tool, you can follow these steps:

1. Define plugin interface: Create a well-defined plugin interface that specifies the methods and properties each plugin must implement. This will ensure consistency and compatibility between different plugins and the CLI tool.

2. Load plugins: Add support for loading plugins, either from the user's home directory or the current directory. You can use dynamic imports to load TypeScript files or use the Deno plugin system to load native binary plugins.

3. Register plugins: Maintain a list of registered plugins within the CLI tool. You can use this list to execute plugin-specific functionality at various points during the CLI tool's execution.

4. Invoke plugins: Identify the points in your CLI tool's code where you want to provide plugin support, and call the appropriate plugin methods at those points. For instance, you can invoke plugins right before sending a request to the GPT-3 API or right after receiving the response.

5. Pass data to plugins: Allow plugins to read user's and assistant's messages by passing relevant data as arguments to the plugin methods. This will enable plugins to analyze and react to the conversation context.

6. Expand CLI tool: Add support for executing specific commands or spawning new instances of the CLI tool to perform sub-tasks instructed by the plugins. This will help in extending the functionality of the CLI tool beyond its basic functionalities.

7. System messages: Allow plugins to have specific system messages for the spawned CLI tool subprocesses. This can be used to trigger specific behavior in the spawned instances based on the plugin requirements.

8. Plugin configuration and management: Provide a mechanism to configure and manage plugins, such as enabling or disabling specific plugins, installing new plugins, and updating existing ones.

Once you have implemented these steps, you will have a CLI tool that supports plugins, allowing users to extend and customize its functionality according to their requirements.

# user:
Do you have any specific technical details on point 1? How such an interface could look like considering the features and goals we want to support?

# assistant:
Sure, here's an example of a plugin interface that can be used to achieve the goals and features you want to support:

```typescript
// src/Plugin.ts

interface GptPlugin {
  // The name of the plugin
  name: string;

  // Called when the plugin is initialized, e.g., during the startup of the CLI tool.
  onInitialize?(): Promise<void> | void;

  // Called when a new message is added to the conversation (both user's and assistant's messages)
  onMessageAdded?(
    message: Message,
    conversation: Message[]
  ): Promise<void> | void;

  // Called before sending a request to the GPT-3 API. It allows modifying the request or canceling it.
  beforeSendRequest?(
    request: GptRequest
  ): Promise<GptRequest | null> | GptRequest | null;

  // Called after receiving a response from the GPT-3 API. It allows modifying the response or triggering some action (e.g., executing commands or spawning new CLI instances).
  afterReceiveResponse?(
    response: GptResponse
  ): Promise<GptResponse | void> | GptResponse | void;

  // Called before the conversation is persisted, after receiving a new message.
  beforePersistConversation?(
    conversation: Message[]
  ): Promise<Message[]> | Message[];

  // Called when the CLI tool encounters an error. It allows plugins to handle or log specific errors.
  onError?(error: Error): Promise<void> | void;

  // Called during the termination of the CLI tool. It allows plugins to perform cleanup tasks, such as closing database connections or terminating subprocesses.
  onTerminate?(): Promise<void> | void;
}

type GptRequest = {
  // The request related data to GPT-3 API, e.g., messages and configuration
};

type GptResponse = {
  // The response related data received from the GPT-3 API, e.g., generated content, role
};

```

With this plugin interface, you allow plugins to interact with various aspects of your CLI tool, such as manipulating requests and responses, handling errors, and reacting to messages in the conversation. The use of optional methods like `onInitialize`, `beforePersistConversation`, and others, makes it easy for plugin authors to implement only the functionality they need.

Note that based on your specific requirements, you may need to modify or extend the interfaces for `GptRequest`, `GptResponse`, and `Message`. This proposed interface serves as a starting point to guide the development of a plugin system for your CLI tool.

# user:
Do you have any specific technical details on point 6? How this could be implemented? Provide just a draft.

# assistant:
For point 6, one way to implement executing specific commands or spawning new instances of the CLI tool is by using a message-based approach. In this approach, plugins can send and receive messages to instruct the CLI tool to perform sub-tasks.

Here's a draft of how to implement this:

1. Define a message format: Create a consistent format for messages that will be used to communicate between the plugins and the CLI tool. The messages can contain information such as command, arguments, and metadata (e.g., sender or timestamp).

```typescript
interface PluginMessage {
  cmd: string;
  args?: any;
  metadata?: Record<string, any>;
}
```

2. Create a message bus: Implement a simple message bus that allows plugins and the CLI tool to send and receive messages. The message bus should store registered recipients and handle message delivery between them.

```typescript
class MessageBus {
  private recipients: Map<string, (message: PluginMessage) => void>;

  constructor() {
    this.recipients = new Map();
  }

  register(name: string, callback: (message: PluginMessage) => void) {
    this.recipients.set(name, callback);
  }

  unregister(name: string) {
    this.recipients.delete(name);
  }

  sendMessage(message: PluginMessage) {
    for (const [_, callback] of this.recipients.entries()) {
      callback(message);
    }
  }
}
```

3. Implement message handling in the CLI tool: Add methods in the CLI tool to handle incoming plugin messages, perform the specified command or sub-task, and possibly send a response.

```typescript
class CliTool {
  handleMessage(message: PluginMessage) {
    switch (message.cmd) {
      case 'spawn_instance':
        this.spawnInstance(message.args);
        break;
      // Add other command handling here
      default:
        console.error('Unknown command:', message.cmd);
    }
  }

  spawnInstance(args: any) {
    // Create a new instance of the CLI tool and perform the specified sub-task
    // This could involve executing external commands or running functions within the same script
  }
}
```

4. Use the message bus to facilitate communication: In the CLI tool and plugins, use the message bus to send messages and handle them.

```typescript
// CLI tool
const messageBus = new MessageBus();
const cliTool = new CliTool();
messageBus.register('cliTool', (message) => cliTool.handleMessage(message));

// Plugin
messageBus.sendMessage({
  cmd: 'spawn_instance',
  args: { /* Sub-task specific arguments */ },
});
```

This is just a draft of how you could implement point 6. Depending on your design and requirements, you may want to modify this approach or consider other solutions, such as using an event-driven architecture or remote procedure calls (RPC).

