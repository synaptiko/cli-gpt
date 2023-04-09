import { load } from 'std/dotenv/mod.ts';
import { join } from 'std/path/mod.ts';
import { writeText as copyToClipboard } from 'copy_paste/mod.ts';
import { prompt } from './prompt.ts';
import { ChatCompletion } from './ChatCompletion.ts';
import { printHelp } from './printHelp.ts';
import { ConversationPersistance } from './ConversationPersistance.ts';
import { parseArgs } from './parseArgs.ts';

// TODO: add ability to set the other model params with env vars

const env = await load({
  envPath: join(Deno.env.get('HOME')!, '.cli-gpt'),
});

if (env.OPENAI_API_KEY === undefined) {
  console.error('OPENAI_API_KEY environment variable is not set');
  Deno.exit(1);
}

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
    const chatCompletion = new ChatCompletion(env.OPENAI_API_KEY, env.MODEL);
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
