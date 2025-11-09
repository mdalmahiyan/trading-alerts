const fetch = require('node-fetch');
require('dotenv').config();

async function fetchPriceForSymbol(symbol) {
  if (!symbol) throw new Error('symbol required');
  if (symbol.startsWith('BINANCE:')) {
    const s = symbol.split(':')[1];
    const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${s}`);
    const j = await r.json();
    return parseFloat(j.price);
  }
  if (symbol.includes(':')) {
    const [exchange, sym] = symbol.split(':');
    if (process.env.MARKET_PROVIDER === 'finnhub') {
      const key = process.env.MARKET_API_KEY;
      const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${key}`);
      const j = await r.json();
      return parseFloat(j.c);
    }
  }
  const encoded = encodeURIComponent(symbol.replace(':', '/'));
  const r = await fetch(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encoded}`);
  const j = await r.json();
  if (j && j.quoteResponse && j.quoteResponse.result && j.quoteResponse.result[0]) {
    return parseFloat(j.quoteResponse.result[0].regularMarketPrice);
  }
  throw new Error('Could not fetch price for ' + symbol);
}

module.exports = { fetchPriceForSymbol };
