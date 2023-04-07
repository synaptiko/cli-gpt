#!/usr/bin/env deno run --allow-net --allow-read --allow-env --unstable
import { load } from "https://deno.land/std@0.180.0/dotenv/mod.ts";

// TODO: verify that env.OPENAI_KEY is set
// TODO: add ability to keep the conversation persistent in a file
// TODO: add ability to reset the conversation
// TODO: add ability to set the model with env var
// TODO: add ability to set the role for a message
// TODO: add ability to have initial system message + example conversation which is out of the persisted conversation
// TODO: add ability to either pass the message as a command line argument or as a stdin (for stdin reading, use Node.js compatibility layer and readline interface)
// TODO: investigate GitHub actions to build this into a binary for various architectures
// TODO: add ability to configure envs in some config file

const env = await load();
const response = await fetch('https://api.openai.com/v1/chat/completions', {
	method: 'POST',
	headers: {
		'Content-Type': 'application/json',
		'Authorization': `Bearer ${env.OPENAI_KEY}`,
	},
	body: JSON.stringify({
		model: 'gpt-4',
		messages: [{ role: 'user', content: Deno.args.join(' ') || 'tell joke' }],
		stream: true,
	}),
});
const decoder = new TextDecoder();
const encoder = new TextEncoder();

if (!response.ok || response.body === null) {
	console.error('Error:', response.statusText);
	Deno.exit(1);
}

for await (const chunk of response.body) {
	const decodedChunk = decoder.decode(chunk);
	const lines = decodedChunk.split('\n');

	for (const line of lines) {
		if (line.startsWith('data: ')) {
			const payload = line.slice(6);

			if (payload !== '[DONE]') {
				const message = JSON.parse(payload);
				const delta = message.choices[0].delta;
				const { content } = delta;

				if (content !== undefined) {
					Deno.stdout.write(encoder.encode(content));
				}
			}
		}
	}
}
console.log();
