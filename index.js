const XMPP = require('node-xmpp-core')
XMPP.Client = require('node-xmpp-client')
const debug = require('debug')('xmpp-bot')
const util = require('util')
const uuid = require('uuid')
const _ = require('lodash')

const NS_MUC = 'http://jabber.org/protocol/muc'
const NS_DISCO = 'http://jabber.org/protocol/disco#info'
const NS_DATA_FORM = 'jabber:x:data'

class XMPPBot {
  constructor (options) {
    options = Object.assign({
      reconnect: true
    }, options)
    let {rooms} = options
    this.roomnick = {}
    this.commands = {}
    this.commandState = {}
    this.client = new XMPP.Client(options)
    debug('Starting XMPP bot')
    this.client.on('stanza', this.onStanza.bind(this))
    this.client.on('online', () => {
      debug('online')
      this.client.send(new XMPP.Stanza('presence', {})
        .c('show').t('chat').up()
        .c('status').t('Accepting commands'))
      if (rooms) {
        _.forEach(rooms, room => {
          room.nick = room.nick || 'flix'
          this.roomnick[room.jid] = room.nick
          debug('Joining ' + room.jid + ' with nick ' + room.nick)
          this.client.send(new XMPP.Stanza('presence', {
            to: room.jid + '/' + room.nick
          }).c('x', { xmlns: NS_MUC }))
        })
      }
    })
    process.on('exit', this.disconnect.bind(this))
  }

  addContact (jid, name) {
    this.client.send(new XMPP.Stanza('iq', {type: 'set'})
      .c('query', {xmlns: 'jabber:iq:roster'})
        .c('item', {jid, name})
      )
  }

  command (name, callback) {
    this.commands[name] = callback
    this.commandState[name] = {}
  }

  execCommand (commandName, to, args, messageType) {
    let command = this.commands[commandName]
    if (!command) return
    const answer = (answer) => {
      let message = new XMPP.Stanza('message', {
        type: messageType,
        to: to
      })
      if (answer instanceof XMPP.Element) {
        answer = answer.tree()
        if (answer.name === 'message') {
          message.children = answer.children
        } else {
          message.cnode(answer)
        }
      } else {
        if (typeof answer !== 'string') {
          answer = util.inspect(answer)
        }
        message.c('body').t(answer)
      }
      this.client.send(message)
    }
    let result = command(answer, args, this.commandState[commandName], this.commandState)
    if (result) {
      answer(result)
    }
  }

  onStanza (stanza) {
    if (stanza.is('presence') && stanza.attrs.type === 'subscribe') {
      this.client.send(new XMPP.Stanza('presence', {
        id: uuid(),
        type: 'subscribed',
        to: stanza.attrs.from
      }))
    }
    if (stanza.is('iq') && stanza.attrs.type === 'get') {
      if(stanza.getChild('query', NS_DISCO)) {
        this.sendIqResult(stanza, new XMPP.Element('query', {xmlns: NS_DISCO})
          .c('identity', {category: 'client', type: 'bot'}).up()
          .c('x', {xmlns: NS_DATA_FORM, type: 'result'})
            .c('field', {var: 'software'}).c('value').t('node-xmpp-client').up().up()
          .root()
        )
      }
    }
    if (!stanza.is('message') ||
      (stanza.attrs.type !== 'chat' && stanza.attrs.type !== 'groupchat') ||
      stanza.getChild('delay')) return
    debug('received ' + stanza.toString())
    let text = stanza.getChildText('body')
    if (!text) return
    let room = null
    if (stanza.attrs.type === 'groupchat') {
      room = stanza.attrs.from.substr(0, stanza.attrs.from.indexOf('/'))
      let nick = this.roomnick[room]
      if (!nick) return
      if (text.indexOf(`@${nick} `) >= 0) {
        text = text.replace(`@${nick} `, '')
      } else if (text.indexOf(nick + ' ') >= 0) {
        text = text.replace(nick + ' ', '')
      } else {
        return
      }
    }
    text = _.filter(text.split(/\s+/))
    if (text.length === 0) return
    debug('Command: ' + text)
    this.execCommand(
      text[0],
      room || stanza.attrs.from,
      text.slice(1),
      stanza.attrs.type
    )
  }

  sendIqResult (id, to, result) {
    if (id instanceof XMPP.Element) {
      result = to
      to = id.attrs.from
      id = id.attrs.id
    }
    let iq = new XMPP.Stanza('iq', {id, to, type: 'result'})
    if (!result) result = []
    if (result.length === undefined) result = [result]
    iq.children = result
    this.client.send(id)
  }

  disconnect () {
    this.client.end()
  }
}

module.exports = XMPPBot
