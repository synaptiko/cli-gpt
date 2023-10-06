# TODO

- [ ] Implement basic plugin system with function calling
  - [x] Implement function calling logic
  - [x] Implement loading of function definitions from some directory (~/.cli-gpt-plugins)
  - [x] Implement calling function as scripts from the same directory with defs
  - [ ] Implement some logic to select specific functions (introduce plugin groups/context?; or param/prompt)
  - [ ] Add settings for how to work with function calls: with/without confirmation; with/without logging and how verbose
- [ ] Implement agent system with plugins
  - [ ] Prerequisite: deal with rate limits and other errors:
    https://platform.openai.com/docs/guides/rate-limits/error-mitigation
    https://platform.openai.com/docs/guides/error-codes
  - [ ] Prerequisite: add basic cost calculations
  - [ ] Prerequisite: Keep history of used tokens per conversation and globally (+ have estimation of cost)
  - [ ] Add a way to describe an agent; definition under some directory (~/.cli-gpt-agents)
  - [ ] Add a way to trigger an agent
    - It will use function calls; each agent will be described as a function available in specific conversation
    - Agent will be "an instance" of another `cli-gpt` chat with specific system message, plugins, other agents and history (can be permanent or not, or somehow resettable/shareable)
  - [ ] Add cost/time/message amount limits for conversations using agents
- [ ] Implement hooks for additional message adjustments before/after sending (or various other events while chatting?)
