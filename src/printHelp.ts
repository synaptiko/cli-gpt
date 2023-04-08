import { basename } from 'std/path/mod.ts';

export function printHelp() {
  const projectName = 'cli-gpt';
  let binName = basename(Deno.execPath());

  if (binName === 'deno') {
    binName = 'deno task -q run';
  }

  console.log(`
${projectName}: A CLI tool to interact with OpenAI's Chat Completion API.

Usage: ${binName} [options] [prompt]

Options:
  --user, -u              Set the role for the message as 'user'.
  --assistant, -a         Set the role for the message as 'assistant'.
  --system, -s            Set the role for the message as 'system'.
  --multiline, -m         Enable multiline input.
  --read, -r [file(s)]    Read file(s) and use their content in the prompt.
  --initial, -i           Add to or reset the initial messages.
  --one-shot, -o          Prompt without persisted conversation, do not save the result.
  --copy, -c              Copy the response to the clipboard.
  --reset, -e             Reset the conversation.
  --help, -h              Display this help message and exit.

Input:
  prompt                  Text content to send to the API (in case or 'user' role)
                          or to add to the conversation
                          (in case of 'assistant' or 'system' roles).
                          Tip: Wrap the prompt in quotes to avoid shell expansion.

When no prompt is provided, the user will be prompted to enter it over standard input.

When --read or --multiline option is used, the prompt has to be provided over standard input.

When --reset option is used, the prompt is ignored completely. It only resets the conversation.

Examples:
  ${binName} "What is OpenAI?"
  ${binName} -s You are a helpful assistant.
  ${binName} -m
  ${binName} -r src/index.ts README.md
  ${binName} --reset

Note: Set the OPENAI_API_KEY and MODEL (defaults to 'gpt-4') environment variable in '~/.cli-gpt' file.
`);
}
