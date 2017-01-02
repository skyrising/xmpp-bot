# xmpp-bot
## A bot that handles commands for you
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?maxAge=2592000&style=flat-square)](http://standardjs.com/)
[![license](https://img.shields.io/github/license/skyrising/xmpp-bot.svg?maxAge=2592000&style=flat-square)](https://raw.githubusercontent.com/skyrising/xmpp-bot/master/LICENSE)

### Usage

```javascript
const XMPPBot = require('node-xmpp-bot');

let bot = new XMPPBot({
  jid: 'juliet@capulet.tld',
  password: 'romeo',
  rooms: [
    {jid: 'coven@chat.shakespeare.lit', nick: 'juliet'}
  ]
})

// register a command
bot.command('name', (answer, args, state, env) => {
  ... // do some work
  answer(...) // answer with results
})

// or just return answer
bot.command('echo', (answer, args) => args.join(' '))

// disconnect when your done (automatically done on process exit)
bot.disconnect();
```

#### Options

- [node-xmpp-client](http://node-xmpp.org/doc/client.html)'s
- `rooms`: List of rooms `{jid, nick}` the bot should join

#### Commands

Command functions are passed 4 arguments:

- answer: function that sends the provided text or XML element
- args: array of arguments
- state: an object that is saved for this command (`=env[command-name]`)
- env: state shared by all commands

Commands are executed when a message sent to the bot starts with their name
or when the bot is mentioned with `@nick <command> [args]` in a MUC (multi-user-chat)
