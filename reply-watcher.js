/**
 * Reply Watcher
 * Polls Gmail IMAP for replies to Strider outreach
 * Notifies Fred via Telegram when a prospect replies
 */

const Imap = require('imap')
const { simpleParser } = require('mailparser')
const https = require('https')

const POLL_INTERVAL_MS = 2 * 60 * 1000 // 2 minutes
const SEEN_FILE = require('path').join(__dirname, 'seen-replies.json')
const fs = require('fs')

function loadSeen() {
  try { return new Set(JSON.parse(fs.readFileSync(SEEN_FILE, 'utf8'))) } catch { return new Set() }
}
function saveSeen(set) {
  fs.writeFileSync(SEEN_FILE, JSON.stringify([...set]))
}

function sendTelegram(text) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
  const FRED = process.env.FRED_CHAT_ID || '6850556217'
  const payload = JSON.stringify({ chat_id: FRED, text, parse_mode: 'HTML' })
  return new Promise(resolve => {
    const opts = {
      hostname: 'api.telegram.org',
      path: '/bot' + BOT_TOKEN + '/sendMessage',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }
    const req = https.request(opts, res => { res.on('data', () => {}); res.on('end', resolve) })
    req.on('error', resolve); req.write(payload); req.end()
  })
}

function checkInbox() {
  return new Promise((resolve) => {
    const user = process.env.GMAIL_USER
    const pass = process.env.GMAIL_PASS
    if (!user || !pass) { console.log('[Reply Watcher] No Gmail credentials'); return resolve([]) }

    const imap = new Imap({
      user,
      password: pass,
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false }
    })

    const newReplies = []

    imap.once('ready', () => {
      imap.openBox('INBOX', true, (err, box) => {
        if (err) { imap.end(); return resolve([]) }

        // Search for emails in the last 7 days that are replies (have Re: in subject)
        const since = new Date()
        since.setDate(since.getDate() - 7)

        imap.search(['UNSEEN', ['SINCE', since]], (err, results) => {
          if (err || !results || results.length === 0) { imap.end(); return resolve([]) }

          const f = imap.fetch(results, { bodies: '', markSeen: false })

          f.on('message', (msg) => {
            let rawEmail = ''
            msg.on('body', stream => { stream.on('data', c => rawEmail += c) })
            msg.once('end', async () => {
              try {
                const parsed = await simpleParser(rawEmail)
                const subject = parsed.subject || ''
                const from = parsed.from?.text || ''
                const messageId = parsed.messageId || ''
                const inReplyTo = parsed.inReplyTo || parsed.headers?.get('in-reply-to') || ''
                const references = parsed.references || []

                // Only flag if it's a reply (has Re: or references/in-reply-to header)
                const isReply = subject.toLowerCase().startsWith('re:') || inReplyTo || (references && references.length > 0)
                if (!isReply) return

                newReplies.push({ from, subject, messageId, text: parsed.text?.slice(0, 300) || '' })
              } catch (e) {
                console.error('[Reply Watcher] Parse error:', e.message)
              }
            })
          })

          f.once('error', () => { imap.end(); resolve(newReplies) })
          f.once('end', () => { imap.end(); resolve(newReplies) })
        })
      })
    })

    imap.once('error', (err) => { console.error('[Reply Watcher] IMAP error:', err.message); resolve([]) })
    imap.connect()
  })
}

async function poll() {
  console.log('[Reply Watcher] Checking inbox...')
  const seen = loadSeen()

  try {
    const replies = await checkInbox()
    for (const reply of replies) {
      if (seen.has(reply.messageId)) continue
      seen.add(reply.messageId)

      const preview = reply.text?.slice(0, 200).replace(/\n+/g, ' ').trim() || ''
      const msg = `<b>Prospect replied</b>\n\n<b>From:</b> ${reply.from}\n<b>Subject:</b> ${reply.subject}\n\n${preview}${preview.length >= 200 ? '...' : ''}\n\n<i>Reply in Gmail to respond.</i>`

      await sendTelegram(msg)
      console.log('[Reply Watcher] Notified:', reply.from)
    }
    saveSeen(seen)
  } catch (e) {
    console.error('[Reply Watcher] Error:', e.message)
  }

  setTimeout(poll, POLL_INTERVAL_MS)
}

// Start polling
setTimeout(poll, 10000) // first check 10s after startup
console.log('[Reply Watcher] Started - polling every 2 minutes')
