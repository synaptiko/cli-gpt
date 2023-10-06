/*!
 * cli-gpt
 * Copyright (c) 2023 Jiří Prokop | synaptiko.cz
 * Licensed under the MIT License (https://opensource.org/licenses/MIT)
 */
import { writeText as copyToClipboard } from 'copy_paste/mod.ts';
import { prompt } from './prompt.ts';
import { ChatCompletion, FunctionCallResponse, isContent, isFunctionCall } from './ChatCompletion.ts';
import { printHelp } from './printHelp.ts';
import { AssistantCallingFunctionRole, AssistantRole, ConversationPersistance, FunctionResultRole, UserRole } from './ConversationPersistance.ts';
import { parseArgs } from './parseArgs.ts';
import { loadConfig } from './loadConfig.ts';
import { loadFunctions } from './loadFunctions.ts';

const config = await loadConfig();
const { definitions: functionDefinitions, functions } = await loadFunctions();
const chatCompletion = new ChatCompletion(config);
const conversationPersistance = new ConversationPersistance();
const { flags, role, readFiles, prompt: promptFromArgs } = parseArgs();
const { affectInitialMessages, oneShot } = flags;
const persistanceDestination = affectInitialMessages ? 'initial' : oneShot ? 'one-shot' : 'conversation';

if (flags.help) {
  printHelp();
  Deno.exit(0);
} else if (flags.reset) {
  conversationPersistance.reset(
    flags.affectInitialMessages ? ['initial', 'conversation', 'one-shot'] : ['conversation', 'one-shot'],
  );
  Deno.exit(0);
}

function sendFunctionResult(name: string, result: string) {
  chatCompletion.addMessage({
    role: FunctionResultRole,
    name,
    content: result,
  });
  conversationPersistance.append({
    role: FunctionResultRole,
    content: [name, result].join('\n'),
    destination: persistanceDestination,
  });
}

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

conversationPersistance.append({ role, content, destination: persistanceDestination });

if (role === UserRole) {
  const encoder = new TextEncoder();
  const write = (chunk: string) => Deno.stdout.write(encoder.encode(chunk));
  const fullContent = [];

  chatCompletion.setFunctions(functionDefinitions);

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

    try {
      while (!chatCompletion.isFinished) {
        let responseContent: undefined | string[] = undefined;
        let responseFunctionCall: undefined | FunctionCallResponse['functionCall'] = undefined;

        for await (const chunk of chatCompletion.complete(abortSignal)) {
          if (isContent(chunk)) {
            const { content } = chunk;

            if (responseContent === undefined) {
              conversationPersistance.appendPartial({ roleOrChunk: AssistantRole, destination: persistanceDestination });
              responseContent = [];
            }

            responseContent.push(content);
            write(content);
            conversationPersistance.appendPartial({ roleOrChunk: content, destination: persistanceDestination });
          }

          if (isFunctionCall(chunk)) {
            responseFunctionCall = chunk.functionCall;
          }
        }

        if (responseContent) {
          conversationPersistance.appendPartial({ roleOrChunk: '\n\n', destination: persistanceDestination });
          fullContent.push(...responseContent);
          if (chatCompletion.isFinished) {
            write('\n');
          } else {
            write('\n\n');
          }
        }

        if (responseFunctionCall) {
          write(`[Calling ${responseFunctionCall.name} function...]\n\n`);

          conversationPersistance.append({
            role: AssistantCallingFunctionRole,
            content: [
              responseFunctionCall.name,
              JSON.stringify(JSON.parse(responseFunctionCall.arguments), null, 2)
            ].join('\n'),
            destination: persistanceDestination,
          });

          if (responseFunctionCall.name in functions) {
            const fn = functions[responseFunctionCall.name];

            sendFunctionResult(responseFunctionCall.name, await fn(responseFunctionCall.arguments));
          } else {
            // this is to avoid infinite loop when function is not implemented
            sendFunctionResult(responseFunctionCall.name, JSON.stringify('Unknown function'));
          }
        }
      }
    } catch (error) {
      if (error.message !== 'The signal has been aborted') {
        console.log('Error:', error);
      }
    }

    if (flags.copyResponse && fullContent.length > 0) {
      copyToClipboard(fullContent.join(''));
    }
  } catch (error) {
    console.error('Error:', error.message);
    Deno.exit(1);
  }
}
