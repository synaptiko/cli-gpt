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
      Deno.removeSync(affectInitialMessages ? initialMessagesPath : conversationPath);
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
