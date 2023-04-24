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
      chatCompletion.setMessages([...conversationPersistance.getMessages({ onlyInitial: true }), { role: 'user', content }]);
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
