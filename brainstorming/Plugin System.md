# user:
Based on content of src/index.ts, src/parseArgs.ts, src/ChatCompletion.ts, src/ConversationPersistance.ts.

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

