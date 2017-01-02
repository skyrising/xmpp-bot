const XMPP = require('node-xmpp-core');
XMPP.Client = require('node-xmpp-client');
const debug = require('debug')('xmpp-bot');
const util = require('util');
const _ = require('lodash');

const chat = (to, str) => {
  const stanza = new XMPP.Stanza('message', {
    to, type: 'chat'
  });
  stanza.c('body').t(str);
  return stanza;
}

class XMPPBot {
  constructor(options) {
    options = Object.assign({
      reconnect: true
    }, options);
    let {rooms} = options;
    this.roomnick = {};
    this.commands = {};
    this.commandState = {};
    this.client = new XMPP.Client(options);
    debug('Starting XMPP bot')
    this.client.on('stanza', this.onStanza.bind(this));
    this.client.on('online', () => {
      debug('online');
      this.client.send(new XMPP.Stanza('iq'))
      this.client.send(new XMPP.Stanza('presence', {})
        .c('show').t('chat').up()
        .c('status').t('Accepting commands'));
      if(rooms)
        _.forEach(rooms, room => {
          room.nick = room.nick || 'flix';
          this.roomnick[room.jid] = room.nick;
          debug('Joining ' + room.jid + ' with nick ' + room.nick)
          this.client.send(new XMPP.Stanza('presence', {
            to: room.jid +'/' + room.nick
          }).c('x', { xmlns: 'http://jabber.org/protocol/muc' }))
        })
    })
    process.on('exit', this.disconnect.bind(this))
  }

  addContact(jid, name) {
    this.client.send(new XMPP.Stanza('iq', {type: 'set'})
      .c('query', {xmlns: 'jabber:iq:roster'})
        .c('item', {jid, name})
      )
  }

  command(name, callback) {
    this.commands[name] = callback;
    this.commandState[name] = {};
  }
  
  execCommand(commandName, to, args, messageType) {
    let command = this.commands[commandName];
    if(!command) return;
    const answer = (answer) => {
      let message = new XMPP.Stanza('message', {
        type: messageType,
        to: to
      });
      if(answer instanceof XMPP.Element) {
        answer = answer.tree();
        if(answer.name == 'message')
          message.children = answer.children;
        else
          message.cnode(answer);
      } else {
        if(typeof answer !== 'string')
          answer = util.inspect(answer);
        message.c('body').t(answer);
      }
      this.client.send(message);
    };
    let result = command(answer, args, this.commandState[commandName], this.commandState);
    if(result)
      answer(result);
 }

  onStanza(stanza) {
    debug('received: '+stanza.toString())
    if(!stanza.is('message')
      || (stanza.attrs.type !== 'chat' && stanza.attrs.type !== 'groupchat')
      || stanza.getChild('delay')) return;
    debug(stanza);
    let text = stanza.getChildText('body');
    if(!text) return;
    debug(text);
    let room = null;
    if(stanza.attrs.type === 'groupchat') {
      room = stanza.attrs.from.substr(0, stanza.attrs.from.indexOf('/'));
      let nick = this.roomnick[room];
      debug(`Nick for ${room}: ${nick}`);
      if(!nick) return;
      if(text.indexOf('@'+nick+' ') >= 0)
        text = text.replace('@'+nick+' ', '')
      else if(text.indexOf(nick + ' ') >= 0)
        text = text.replace(nick+' ', '')
      else return;
      debug(text);
    }
    text = _.filter(text.split(/\s+/));
    if(text.length == 0) return;
    debug(text);
    this.execCommand(
      text[0],
      room ? room : stanza.attrs.from,
      text.slice(1),
      stanza.attrs.type
    );
  }

  disconnect() {
    this.client.end();
  }
}

module.exports = XMPPBot;
