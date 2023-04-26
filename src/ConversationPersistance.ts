const initialMessagesPath = '.cli-gpt.initial.md';
const conversationPath = '.cli-gpt.conversation.md';

export const UserRole = Symbol('user');
export const AssistantRole = Symbol('assistant');
export const SystemRole = Symbol('system');

export type Role = typeof UserRole | typeof AssistantRole | typeof SystemRole;
export type Message = { role: Role; content: string };

function isRole(role: string | Role): role is Role {
  return UserRole === role || AssistantRole === role || SystemRole === role;
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
    this.appendPartial({ roleOrChunk: role, affectInitialMessages });
    this.appendPartial({ roleOrChunk: `${content}\n\n`, affectInitialMessages });
  }

  appendPartial(
    { roleOrChunk, affectInitialMessages }: { roleOrChunk: Role | string; affectInitialMessages: boolean },
  ) {
    if (isRole(roleOrChunk)) {
      Deno.writeTextFileSync(
        affectInitialMessages ? initialMessagesPath : conversationPath,
        `# ${roleOrChunk.description}:\n`,
        { append: true },
      );
    } else {
      Deno.writeTextFileSync(
        affectInitialMessages ? initialMessagesPath : conversationPath,
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
