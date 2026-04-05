const https = require('https')
const http = require('http')

const sessions = {}

function sendMessage(chatId, text, extra) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
  const body = Object.assign({ chat_id: chatId, text, parse_mode: 'HTML' }, extra || {})
  const payload = JSON.stringify(body)
  return new Promise((resolve) => {
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

function getFile(fileId) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
  return new Promise((resolve, reject) => {
    https.get('https://api.telegram.org/bot' + BOT_TOKEN + '/getFile?file_id=' + fileId, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)))
    }).on('error', reject)
  })
}

function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode === 301 || res.statusCode === 302) return downloadBuffer(res.headers.location).then(resolve).catch(reject)
      const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => resolve(Buffer.concat(chunks)))
    }).on('error', reject)
  })
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode === 301 || res.statusCode === 302) return fetchText(res.headers.location).then(resolve).catch(reject)
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d))
    }).on('error', reject)
  })
}

function uploadToGitHub(buf, filename) {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN
  const payload = JSON.stringify({ message: 'upload: ' + filename, content: buf.toString('base64'), branch: 'main' })
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.github.com',
      path: '/repos/freddiestyle-hue/Mzansi/contents/uploads/' + filename,
      method: 'PUT',
      headers: { 'Authorization': 'Bearer ' + GITHUB_TOKEN, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), 'User-Agent': 'MzansiProsBot' }
    }
    const req = https.request(opts, res => {
      res.on('data', () => {}); res.on('end', () => resolve('https://raw.githubusercontent.com/freddiestyle-hue/Mzansi/main/uploads/' + filename))
    })
    req.on('error', reject); req.write(payload); req.end()
  })
}

function slugify(s) { return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) }
function fill(t, d) { return t.replace(/\{\{(\w+)\}\}/g, (_, k) => (d[k] || '')) }

function deployToVercel(data) {
  const VERCEL_TOKEN = process.env.VERCEL_TOKEN
  const PROJECT = process.env.VERCEL_PROJECT || ('mzansi-' + slugify(data.business_name))
  return fetchText('https://raw.githubusercontent.com/freddiestyle-hue/Mzansi/main/index.html').then(template => {
    const html = fill(template, data)
    const payload = JSON.stringify({
      name: PROJECT,
      files: [{ file: 'index.html', data: Buffer.from(html).toString('base64'), encoding: 'base64' }],
      projectSettings: { framework: null }, target: 'production'
    })
    return new Promise((resolve, reject) => {
      const opts = {
        hostname: 'api.vercel.com', path: '/v13/deployments', method: 'POST',
        headers: { 'Authorization': 'Bearer ' + VERCEL_TOKEN, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
      }
      const req = https.request(opts, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d))) })
      req.on('error', reject); req.write(payload); req.end()
    })
  })
}

const L = {
  en: {
    q1: 'Welcome to <b>Mzansi Pros</b>!\n\nWe build professional websites for tradespeople across South Africa. Five questions, 48 hours, and you have a website your customers can find.\n\nNo tech skills needed. No monthly fees. R589, once.\n\nLet\'s start.\n\n<b>What is your business name and trade?</b>\n<i>e.g. Benny Painting, Sipho Plumbing, Thandi Electricals</i>',
    q2: s => 'Got it - <b>' + s.name + '</b>\n\n<b>Which area do you serve?</b>\n<i>e.g. Mitchells Plain, Cape Town</i>',
    q3: '<b>What is your phone number for customers?</b>\n<i>e.g. 0821234567</i>',
    q4: '<b>Send a photo of your work.</b>\n<i>A clear photo of a completed job works best.</i>',
    q5: 'Almost done! Tell us about your work:\n\n1. How many years experience do you have?\n2. What are your main services? (list them)\n3. What makes customers choose you?\n\n<i>e.g. 12 years. Interior painting, exterior, waterproofing. I am neat, on time and give free quotes.</i>',
    uploading: 'Uploading photo...',
    building: 'Building your website... About 30 seconds.',
    done: url => 'Your website is live!\n\n<b>' + url + '</b>\n\nShare this with your customers. Welcome to Mzansi Pros!',
    err: 'Something went wrong. Please try again.'
  },
  af: {
    q1: 'Welkom by <b>Mzansi Pros</b>!\n\nOns bou professionele webwerwe vir ambagsmanne regoor Suid-Afrika. Vyf vrae, 48 uur, en jy het \'n webwerf wat kli ente kan vind.\n\nGeen tegnologiese vaardighede nodig nie. Geen maandelikse fooie nie. R589, eenmalig.\n\nKom ons begin.\n\n<b>Wat is jou besigheidsnaam en ambag?</b>\n<i>bv. Benny Skilder, Sipho Loodgieter</i>',
    q2: s => 'Goed - <b>' + s.name + '</b>\n\n<b>Watter area bedien jy?</b>\n<i>bv. Mitchells Plain, Kaapstad</i>',
    q3: '<b>Wat is jou foonnommer vir kliente?</b>\n<i>bv. 0821234567</i>',
    q4: '<b>Stuur \'n foto van jou werk.</b>',
    q5: 'Amper klaar! Vertel ons van jou werk:\n\n1. Hoeveel jaar ondervinding?\n2. Wat is jou hoofdi enste?\n3. Wat maak jou spesiaal?',
    uploading: 'Foto word opgelaai...',
    building: 'Webwerf word gebou... Sowat 30 sekondes.',
    done: url => 'Jou webwerf is lewendig!\n\n<b>' + url + '</b>\n\nWelkom by Mzansi Pros!',
    err: 'Iets het fout gegaan. Probeer weer.'
  },
  zu: {
    q1: 'Siyakwamukela ku-<b>Mzansi Pros</b>!\n\nSakha izikhumbuzo zomsebenzi ezikhethekile kubantu abenza umsebenzi ngeminyakatizo yonke iNingizimu Afrika. Imibuzo emihlanu, amahora angama-48, futhi unezikhumbuzo ezizofinyelela kumagcokama.\n\nAkudingi ulwazi lobuchwepheshe. Akukho imali yenyanga. R589, kanye nje.\n\nAsiqale.\n\n<b>Yiliphi igama lebhizinisi lakho?</b>\n<i>isb. Benny Ukupenda, Sipho Izicoci</i>',
    q2: s => 'Kulungile - <b>' + s.name + '</b>\n\n<b>Yisiphi isigodi osebenza kuso?</b>',
    q3: '<b>Yini inombolo yakho yefoni?</b>',
    q4: '<b>Thumela isithombe somsebenzi wakho.</b>',
    q5: 'Siyaqeda! Sikhulume ngomsebenzi wakho:\n\n1. Iminyaka emingaki?\n2. Imisebenzi emi-3 enkulu?\n3. Yini okwenza ube ngcono?',
    uploading: 'Iyalayisha...',
    building: 'Yakha iwebhusayithi... Imizuzwana engu-30.',
    done: url => 'Iwebhusayithi yakho iphila!\n\n<b>' + url + '</b>\n\nSiyakwamukela ku-Mzansi Pros!',
    err: 'Kukhona inkinga. Zama futhi.'
  },
  xh: {
    q1: 'Wamkelekile ku-<b>Mzansi Pros</b>!\n\nSakha iiwebhusayithi ezineenkathalo zabasebenzi kulo lonke uMzantsi Afrika. Imibuzo emihlanu, iiyure ezingama-48, unewebhusayithi abafumani bakho banokuifumana.\n\nAkufuneki izakhono zobuchwepheshe. Akukho iintlawulo zenyanga. R589, kanye.\n\nSiqale.\n\n<b>Ngubani igama lebhizinisi lakho?</b>\n<i>umz. Benny Ukupenda, Sipho Izicoci</i>',
    q2: s => 'Kulungile - <b>' + s.name + '</b>\n\n<b>Yeyiphi indawo osebenza kuyo?</b>',
    q3: '<b>Yintoni inombolo yakho yomnxeba?</b>',
    q4: '<b>Thumela umfanekiso womsebenzi wakho.</b>',
    q5: 'Siyaphela! Sithethe ngomsebenzi wakho:\n\n1. Iminyaka emingaphi?\n2. Iinkonzo ezi-3 eziphambili?\n3. Yintoni ekwenza ube ngcono?',
    uploading: 'Iyalayisha...',
    building: 'Yakha iwebhusayithi... Imizuzu engama-30.',
    done: url => 'Iwebhusayithi yakho iphilile!\n\n<b>' + url + '</b>\n\nWamkelekile ku-Mzansi Pros!',
    err: 'Kukhona ingxaki. Zama kwakhona.'
  }
}

async function handle(chatId, message) {
  let s = sessions[chatId] || { step: -1, lang: 'en', data: {} }

  if (message.text && (message.text === '/start' || message.text === '/restart')) {
    sessions[chatId] = { step: -1, lang: 'en', data: {} }
    return sendMessage(chatId, 'Welcome to <b>Mzansi Pros</b>!\n\nChoose your language:\n\n1. English\n2. Afrikaans\n3. Zulu\n4. Xhosa', {
      reply_markup: { keyboard: [[{ text: '1. English' }, { text: '2. Afrikaans' }], [{ text: '3. Zulu' }, { text: '4. Xhosa' }]], one_time_keyboard: true, resize_keyboard: true }
    })
  }

  if (s.step === -1) {
    const t = (message.text || '').toLowerCase()
    s.lang = t.includes('afrikaans') || t.startsWith('2') ? 'af' : t.includes('zulu') || t.startsWith('3') ? 'zu' : t.includes('xhosa') || t.startsWith('4') ? 'xh' : 'en'
    s.step = 0; sessions[chatId] = s
    return sendMessage(chatId, L[s.lang].q1, { reply_markup: { remove_keyboard: true } })
  }

  const m = L[s.lang]

  if (s.step === 0) {
    if (!message.text) return sendMessage(chatId, 'Please send a text reply.')
    s.data.name = message.text.trim(); s.step = 1; sessions[chatId] = s
    return sendMessage(chatId, m.q2(s.data))
  }
  if (s.step === 1) {
    if (!message.text) return sendMessage(chatId, 'Please send a text reply.')
    s.data.area = message.text.trim(); s.step = 2; sessions[chatId] = s
    return sendMessage(chatId, m.q3)
  }
  if (s.step === 2) {
    if (!message.text) return sendMessage(chatId, 'Please send a text reply.')
    s.data.phone = message.text.trim().replace(/\s/g, ''); s.step = 3; sessions[chatId] = s
    return sendMessage(chatId, m.q4)
  }
  if (s.step === 3) {
    if (!message.photo && !message.document) return sendMessage(chatId, 'Please send a photo.')
    await sendMessage(chatId, m.uploading)
    try {
      const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
      const photo = message.photo ? message.photo[message.photo.length - 1] : message.document
      const fi = await getFile(photo.file_id)
      const fp = fi.result.file_path
      const ext = fp.split('.').pop() || 'jpg'
      const buf = await downloadBuffer('https://api.telegram.org/file/bot' + BOT_TOKEN + '/' + fp)
      const filename = slugify(s.data.name) + '-' + Date.now() + '.' + ext
      s.data.photoUrl = await uploadToGitHub(buf, filename)
      s.step = 4; sessions[chatId] = s
      return sendMessage(chatId, m.q5)
    } catch (e) { console.error(e); return sendMessage(chatId, m.err) }
  }
  if (s.step === 4) {
    if (!message.text) return sendMessage(chatId, 'Please send a text reply.')
    s.data.raw_info = message.text.trim()
    await sendMessage(chatId, m.building)
    try {
      const phone = s.data.phone
      const wa = '27' + phone.replace(/^0/, '')

      // Use Claude to expand raw info into professional copy
      const copy = await generateCopy(s.data)

      const result = await deployToVercel({
        business_name: s.data.name,
        tagline: copy.tagline,
        service_description: copy.about,
        location_area: s.data.area,
        phone_number: phone,
        whatsapp_number: wa,
        hero_image_url: s.data.photoUrl || '',
        service_1: copy.services[0]?.name || '', service_1_desc: copy.services[0]?.desc || '', service_1_price: '',
        service_2: copy.services[1]?.name || '', service_2_desc: copy.services[1]?.desc || '', service_2_price: '',
        service_3: copy.services[2]?.name || '', service_3_desc: copy.services[2]?.desc || '', service_3_price: '',
        service_4: copy.services[3]?.name || '', service_4_desc: copy.services[3]?.desc || '', service_4_price: '',
        service_5: copy.services[4]?.name || '', service_5_desc: copy.services[4]?.desc || '', service_5_price: '',
        gallery_1: s.data.photoUrl || '', gallery_2: '', gallery_3: '', gallery_4: '', gallery_5: '', gallery_6: '',
        testimonial_text: '', testimonial_name: '', testimonial_suburb: '',
        operating_hours: 'Mon-Sat, 7am-6pm'
      })
      if (result.url) {
        await sendMessage(chatId, m.done('https://' + result.url))
        delete sessions[chatId]
      } else throw new Error(JSON.stringify(result))
    } catch (e) { console.error(e); return sendMessage(chatId, m.err) }
  }
}

function claudeRequest(prompt) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return Promise.resolve(null)
  const body = JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 600, messages: [{ role: 'user', content: prompt }] })
  return new Promise((resolve) => {
    const opts = { hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }
    const req = https.request(opts, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d).content?.[0]?.text || '') } catch { resolve('') } }) })
    req.on('error', () => resolve('')); req.write(body); req.end()
  })
}

async function generateCopy(data) {
  const prompt = `You are writing website copy for a South African tradesperson. Write in plain, professional English. No corporate jargon.

Business name: ${data.name}
Area: ${data.area}
What they told us: "${data.raw_info}"

Generate website copy. Return ONLY valid JSON:
{
  "tagline": "One sentence. Trade + area + key strength. Max 10 words.",
  "about": "2-3 sentences about them. Professional, warm, specific. What they do, experience, why customers trust them.",
  "services": [
    {"name": "Service name", "desc": "One sentence description."},
    {"name": "Service name", "desc": "One sentence description."},
    {"name": "Service name", "desc": "One sentence description."}
  ]
}

Extract services from what they said. If they listed services, use those. Make descriptions specific and useful to a customer.`

  const response = await claudeRequest(prompt)
  if (!response) return fallbackCopy(data)

  try {
    const match = response.replace(/```json\s*/g, '').replace(/```/g, '').match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
  } catch (e) { console.error('copy parse error', e) }
  return fallbackCopy(data)
}

function fallbackCopy(data) {
  const lines = (data.raw_info || '').split(/[,\n]/).map(s => s.trim()).filter(s => s.length > 2 && s.length < 50)
  return {
    tagline: 'Professional services in ' + data.area,
    about: data.name + ' provides professional services in ' + data.area + '.',
    services: lines.slice(0, 5).map(l => ({ name: l, desc: '' }))
  }
}

// SDR HITL: in-memory queue (loaded from env or remote)
const sdrQueue = {}

function tgAnswerCallback(id) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
  const payload = JSON.stringify({ callback_query_id: id })
  return new Promise(resolve => {
    const opts = { hostname: 'api.telegram.org', path: '/bot' + BOT_TOKEN + '/answerCallbackQuery', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } }
    const req = https.request(opts, res => { res.on('data', () => {}); res.on('end', resolve) })
    req.on('error', resolve); req.write(payload); req.end()
  })
}

function tgEditMarkup(chatId, messageId, markup) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
  const payload = JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: markup })
  return new Promise(resolve => {
    const opts = { hostname: 'api.telegram.org', path: '/bot' + BOT_TOKEN + '/editMessageReplyMarkup', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } }
    const req = https.request(opts, res => { res.on('data', () => {}); res.on('end', resolve) })
    req.on('error', resolve); req.write(payload); req.end()
  })
}

async function handleCallback(cb) {
  const data = cb.data || ''
  const chatId = cb.message?.chat?.id
  const messageId = cb.message?.message_id
  const [action, idxStr] = data.split(':')
  const idx = parseInt(idxStr)

  if (!['approve','skip','reject'].includes(action) || isNaN(idx)) return

  const FRED = process.env.FRED_CHAT_ID || '6850556217'
  const labels = { approve: 'Approved', skip: 'Skipped', reject: 'Rejected' }
  const emojis = { approve: 'Approved', skip: 'Skipped', reject: 'Rejected' }

  // Store in memory keyed by idx
  sdrQueue[idx] = { action, ts: new Date().toISOString() }

  // Remove buttons
  await tgEditMarkup(chatId, messageId, { inline_keyboard: [] })
  // Confirm
  await sendMessage(FRED, `${labels[action]} #${idx + 1}`)
  await tgAnswerCallback(cb.id)
}

const PORT = process.env.PORT || 3000
http.createServer((req, res) => {
  if (req.method === 'GET') { res.end('Mzansi Pros Bot'); return }
  if (req.method !== 'POST') { res.writeHead(405); res.end(); return }
  let body = ''
  req.on('data', c => body += c)
  req.on('end', async () => {
    try {
      const update = JSON.parse(body)
      if (update.callback_query) {
        await handleCallback(update.callback_query)
      } else {
        const message = update.message || update.edited_message
        if (message) await handle(message.chat.id, message)
      }
    } catch (e) { console.error(e) }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
  })
}).listen(PORT, () => console.log('Mzansi Pros Bot running on port', PORT))
