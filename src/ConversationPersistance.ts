const initialMessagesPath = '.cli-gpt.initial.md';
const conversationPath = '.cli-gpt.conversation.md';
const oneShotConversationPath = '.cli-gpt.conversation.one-shot.md';

export type Destination = 'initial' | 'conversation' | 'one-shot';

export const UserRole = Symbol('user');
export const AssistantRole = Symbol('assistant');
export const AssistantCallingFunctionRole = Symbol('assistant calling function');
export const SystemRole = Symbol('system');
export const FunctionResultRole = Symbol('function result');

export type Role = typeof UserRole | typeof AssistantRole | typeof SystemRole | typeof FunctionResultRole | typeof AssistantCallingFunctionRole;
export type Message = {
  role: typeof UserRole | typeof AssistantRole | typeof SystemRole;
  content: string;
} | {
  role: typeof AssistantCallingFunctionRole;
  name: string;
  arguments: string;
} | {
  role: typeof FunctionResultRole;
  name: string;
  content: string;
};

/************************************************************************
 * TODO for function calling:
 * - add support for function calling to ConversationPersistance
 * - improve logic in index.ts regarding responses with function calls
 * - figure out how to make external commands being used as function calls (base of plugin system)
 */

function isRole(role: string | Role): role is Role {
  return UserRole === role || AssistantRole === role || SystemRole === role || FunctionResultRole === role || AssistantCallingFunctionRole === role;
}

function getDestinationPath(destination: Destination): string {
  switch (destination) {
    case 'initial':
      return initialMessagesPath;
    case 'conversation':
      return conversationPath;
    case 'one-shot':
      return oneShotConversationPath;
  }
}

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

  function pushMessage() {
    if (role === undefined || content.length === 0) {
      return;
    }

    if (role === UserRole || role === SystemRole || role === AssistantRole) {
      messages.push({ role, content: content.join('\n') });
    } else if (role === AssistantCallingFunctionRole) {
      messages.push({ role, name: content[0], arguments: content.slice(1).join('\n') });
    } else if (role === FunctionResultRole) {
      messages.push({ role, name: content[0], content: content.slice(1).join('\n') });
    }

    content = [];
  }

  fileContent.split('\n').forEach((line) => {
    if (line !== '') {
      let newRole: Role | undefined;

      switch (line) {
        case '# system:':
          newRole = SystemRole;
          break;
        case '# assistant:':
          newRole = AssistantRole;
          break;
        case '# user:':
          newRole = UserRole;
          break;
        case '# assistant calling function:':
          newRole = AssistantCallingFunctionRole;
          break;
        case '# function result:':
          newRole = FunctionResultRole;
          break;
      }

      if (newRole !== undefined) {
        pushMessage();

        role = newRole;
      } else {
        content.push(line);
      }
    }
  });

  pushMessage();

  return messages;
}

export class ConversationPersistance {
  reset(destinations: Destination[]) {
    destinations.forEach((destination) => {
      try {
        Deno.removeSync(getDestinationPath(destination));
      } catch {
        // ignore
      }
    });
  }

  append({ role, content, destination }: { role: Role; content: string; destination: Destination }) {
    this.appendPartial({ roleOrChunk: role, destination });
    this.appendPartial({ roleOrChunk: `${content}\n\n`, destination });
  }

  appendPartial(
    { roleOrChunk, destination }: { roleOrChunk: Role | string; destination: Destination },
  ) {
    if (isRole(roleOrChunk)) {
      Deno.writeTextFileSync(
        getDestinationPath(destination),
        `# ${roleOrChunk.description}:\n`,
        { append: true },
      );
    } else {
      Deno.writeTextFileSync(
        getDestinationPath(destination),
        roleOrChunk,
        { append: true },
      );
    }
  }

  getMessages({ onlyInitial }: { onlyInitial?: boolean } = {}): Message[] {
    const initialMessages = readFile(initialMessagesPath);
    const conversation = onlyInitial ? undefined : readFile(conversationPath);

    return [...parseMessages(initialMessages), ...parseMessages(conversation)];
  }
}
