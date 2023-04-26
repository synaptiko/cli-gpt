/*!
 * cli-gpt
 * Copyright (c) 2023 Jiří Prokop | synaptiko.cz
 * Licensed under the MIT License (https://opensource.org/licenses/MIT)
 */
import { writeText as copyToClipboard } from 'copy_paste/mod.ts';
import { prompt } from './prompt.ts';
import { ChatCompletion } from './ChatCompletion.ts';
import { printHelp } from './printHelp.ts';
import { AssistantRole, ConversationPersistance, UserRole } from './ConversationPersistance.ts';
import { parseArgs } from './parseArgs.ts';
import { loadConfig } from './loadConfig.ts';

const config = await loadConfig();
const conversationPersistance = new ConversationPersistance();
const { flags, role, readFiles, prompt: promptFromArgs } = parseArgs();
const { affectInitialMessages, oneShot } = flags;

if (flags.help) {
  printHelp();
} else if (flags.reset) {
  conversationPersistance.reset(
    flags.affectInitialMessages ? ['initial', 'conversation', 'one-shot'] : ['conversation', 'one-shot'],
  );
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

  conversationPersistance.append({
    role,
    content,
    destination: affectInitialMessages ? 'initial' : oneShot ? 'one-shot' : 'conversation',
  });

  if (role === UserRole) {
    const chatCompletion = new ChatCompletion(config);
    const encoder = new TextEncoder();
    const write = (chunk: string) => Deno.stdout.write(encoder.encode(chunk));
    const responseContent = [];

    if (oneShot) {
      chatCompletion.setMessages([...conversationPersistance.getMessages({ onlyInitial: true }), {
        role: UserRole,
        content,
      }]);
    } else {
      chatCompletion.setMessages(conversationPersistance.getMessages());
    }

    try {
      const abortController = new AbortController();
      const { signal: abortSignal } = abortController;

      Deno.addSignalListener('SIGINT', () => {
        abortController.abort();
        console.log('Aborted.');
      });

      conversationPersistance.appendPartial({
        roleOrChunk: AssistantRole,
        destination: affectInitialMessages ? 'initial' : oneShot ? 'one-shot' : 'conversation',
      });

      try {
        for await (const chunk of chatCompletion.complete(abortSignal)) {
          responseContent.push(chunk);
          write(chunk);
          conversationPersistance.appendPartial({
            roleOrChunk: chunk,
            destination: affectInitialMessages ? 'initial' : oneShot ? 'one-shot' : 'conversation',
          });
        }
      } catch (error) {
        if (error.message !== 'The signal has been aborted') {
          console.log('Error:', error);
        }
      }
      write('\n');

      if (flags.copyResponse) {
        copyToClipboard(responseContent.join(''));
      }

      conversationPersistance.appendPartial({
        roleOrChunk: '\n\n',
        destination: affectInitialMessages ? 'initial' : oneShot ? 'one-shot' : 'conversation',
      });
    } catch (error) {
      console.error('Error:', error.message);
      Deno.exit(1);
    }
  }
}
