# cli-gpt [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/synaptiko/cli-gpt/blob/main/LICENSE) [![Deno checks](https://github.com/synaptiko/cli-gpt/actions/workflows/deno-checks.yml/badge.svg)](https://github.com/synaptiko/cli-gpt/actions/workflows/deno-checks.yml) [![Latest GitHub release](https://img.shields.io/github/v/release/synaptiko/cli-gpt?display_name=release)](https://github.com/synaptiko/cli-gpt/releases)

`cli-gpt` is a Command Line Interface (CLI) tool for interacting with OpenAI's Chat Completion API. You can communicate with an AI chatbot and easily manage user, assistant, and system roles in your conversation. The main features of this tool include the ability to persist chat conversations per folder, allowing you to have specific conversations in your home folder and per project. Additionally, you can include any local text files in the conversation and work with various system messages to guide the chatbot's behavior.

## Key Features

- Persistent conversation management per folder (folder = chat thread)
  - Provide an initial system message with `--initial --system`
  - Provide example conversations with `--initial --user` and `--initial --assistant`
  - Reset the session using the `--reset` flag (without `--initial`, the initial messages are retained)
- Include files in the prompt using the `--read` flag
- Enter multiline prompts with the `--multiline` flag

Explore more options by using `cli-gpt --help`.

## Installation

### Steps

1. Install [Deno](https://deno.land/manual/getting_started/installation) on your system.
2. Download [the pre-bundled script](https://github.com/synaptiko/cli-gpt/releases/latest) from GitHub.
3. Unzip the downloaded file:
   ```
   cd ~/Downloads
   unzip cli-gpt.zip && rm cli-gpt.zip
   ```
4. Make it available in your terminal:
   ```
   sudo mv cli-gpt /usr/bin
   # or (if you have ~/.local/bin created and added to your PATH)
   mv cli-gpt ~/.local/bin
   ```
5. Configure `cli-gpt` by creating a `~/.cli-gpt` file with your desired parameters:
   ```
   OPENAI_API_KEY=<Your API Key>
   MODEL=gpt-4
   ```
   Replace `<Your API Key>` with your API key, and `gpt-4` with `gpt-3.5-turbo` if you don't have access to GPT-4 yet.

   You can also provide additional parameters in the `~/.cli-gpt` file, such as `TEMPERATURE`, `TOP_P`, `N`, `MAX_TOKENS`, `PRESENCE_PENALTY`, `FREQUENCY_PENALTY`, `STOP`, and `LOGIT_BIAS`. To learn more about these parameters, refer to the [OpenAI API documentation](https://platform.openai.com/docs/api-reference/chat/create).

### Tips

- You can also clone this repo and run `deno install` (follow the instructions on changing your PATH):
  ```
  deno install -A -c deno.json -n cli-gpt src/index.ts
  ```

- Set up an alias in your shell configuration (`.zshrc`, `.bashrc`, or `config.fish`):
  ```
  alias chai=<path to cli-gp bin>
  ```

- Create a global `.gitignore` file for all repos on your machine by running:
  ```
  git config --global core.excludesfile ~/.gitignore
  ```
  Then, edit your `~/.gitignore` file to exclude `cli-gpt` specific files:
  ```
  .cli-gpt.*
  ```
  This ensures that you won't accidentally commit your chat conversation when working inside a git repository.

## Conversation Files

`cli-gpt` stores the conversation history in two files within the directory where you use the CLI tool:

- `.cli-gpt.initial.md`: This file contains initial messages set using the `--initial` flag. These messages guide the behavior of the chatbot when the conversation starts.
- `.cli-gpt.conversation.md`: This file contains the actual conversation history between the user and the chatbot, including questions and responses.

These files are plain text files in a Markdown format, which makes it easy to read and analyze the content. If you want to access specific parts of the conversation or perform further analysis, you can refer to these files directly. Additionally, you can reset both files using the `--reset` flag if you wish to start a fresh conversation. Remember to exclude these files from version control to avoid accidentally committing confidential or sensitive information.

## Usage Examples

- Get the assistant's response to a prompt:
  ```
  cli-gpt "What is OpenAI?"
  ```

- Add a system message with the `--initial` flag to improve AI's responses. You can also provide conversation examples with `--user` and `--assistant` messages:
  ```
  cli-gpt --initial --system "You are a helpful assistant in the field of programming."
  cli-gpt --initial --user "What is a variable in Python?"
  cli-gpt --initial --assistant "A variable in Python is a symbolic name that represents a value. To assign a value to a variable, you use the equal sign (=). For example, `x = 10` assigns the value 10 to the variable `x`."
  ```

- Send a multiline message:
  ```
  cli-gpt -m
  ```
  In multiline mode, end the message with Ctrl+D after the last line (press Enter first).
  In non-multiline mode, press Enter to send the message.

- Read file content into a prompt:
  ```
  cli-gpt -r src/index.ts README.md
  ```
  This includes the file names and content (in the form of a Markdown snippet) in the prompt. Can be combined with the `--multiline` flag, if needed.

- Reset the conversation:
  ```
  cli-gpt --reset
  ```
  This deletes the current conversation, allowing you to start over. Can be combined with `--initial` to delete the initial messages as well.

## Fun Fact

This README.md and parts of the CLI tool were not only crafted with the assistance of the initial version of `cli-gpt`, but they also had a sprinkle of creativity contributed by both GitHub Copilot and the Custom Brush feature of the GitHub Copilot Labs VSCode extension. In fact, this paragraph itself was playfully rewritten with a touch of AI, showcasing the true power of AI-powered collaboration!
