const express = require('express');
const bodyParser = require('body-parser');
const webpush = require('web-push');
const { fetchPriceForSymbol } = require('./market-provider');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config();

const VAPID_PUBLIC = process.env.VAPID_PUBLIC || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE || '';
if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
  console.warn('VAPID keys not set. Notifications will not work until you set VAPID_PUBLIC and VAPID_PRIVATE in .env');
}
webpush.setVapidDetails('mailto:you@example.com', VAPID_PUBLIC, VAPID_PRIVATE);

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// In-memory stores
const alerts = []; // { id, symbol, condition, price, createdAt }
let pushSubscription = null;

app.get('/api/vapidPublic', (req, res) => res.json({ publicKey: VAPID_PUBLIC }));

app.post('/api/subscribe', (req, res) => {
  pushSubscription = req.body;
  res.sendStatus(201);
});

app.get('/api/alerts', (req, res) => res.json(alerts.slice().reverse()));

app.post('/api/alerts', (req, res) => {
  const { symbol, condition, price } = req.body;
  if (!symbol || !condition || !price) return res.status(400).json({ error: 'missing fields' });
  const id = crypto.randomUUID();
  const newAlert = { id, symbol, condition, price: Number(price), createdAt: Date.now() };
  alerts.push(newAlert);
  res.json(newAlert);
});

app.delete('/api/alerts/:id', (req, res) => {
  const id = req.params.id;
  const idx = alerts.findIndex(a => a.id === id);
  if (idx >= 0) { alerts.splice(idx, 1); res.sendStatus(204); } else res.sendStatus(404);
});

const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '30') * 1000;

async function pollPrices() {
  if (alerts.length === 0) return;
  const bySymbol = {};
  for (const a of alerts) {
    bySymbol[a.symbol] = bySymbol[a.symbol] || [];
    bySymbol[a.symbol].push(a);
  }
  for (const symbol of Object.keys(bySymbol)) {
    try {
      const price = await fetchPriceForSymbol(symbol);
      console.log('price', symbol, price);
      for (const a of bySymbol[symbol]) {
        let triggered = false;
        if (a.condition === 'above' && price >= a.price) triggered = true;
        if (a.condition === 'below' && price <= a.price) triggered = true;
        if (triggered) {
          const payload = JSON.stringify({ title: 'Alert triggered', body: `${symbol} ${a.condition} ${a.price} (now ${price})` });
          if (pushSubscription) {
            webpush.sendNotification(pushSubscription, payload).catch(err => console.error('push error', err));
          }
          console.log('Triggered', a.id);
          const idx = alerts.findIndex(x => x.id === a.id);
          if (idx >= 0) alerts.splice(idx, 1);
        }
      }
    } catch (err) { console.error('price fetch err', err); }
  }
}
setInterval(pollPrices, POLL_INTERVAL);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log('Server listening on', PORT));
