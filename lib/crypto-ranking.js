const axios = require('axios');
const ti = require('technicalindicators');
const moment = require('moment');

// Get swap symbols
async function getSymbols() {
  const url = 'https://www.okx.com/api/v5/public/instruments?instType=SWAP';
  const response = await axios.get(url);
  const data = response.data.data;
  let symbols = data.map(symbol => symbol.instId).filter(instId => instId.includes('USDT'));
  const excludedSymbols = ['USDC-USDT-SWAP', 'TUSD-USDT-SWAP', 'FDUSD-USDT-SWAP'];
  symbols = symbols.filter(symbol => !excludedSymbols.includes(symbol));
  return symbols;
}

// Get historical klines for a symbol
async function getHistoricalKlines(symbol, bar = '1H', limit = 200) {
  const url = `https://www.okx.com/api/v5/market/candles?instId=${symbol}&bar=${bar}&limit=${limit}`;
  while (true) {
      try {
          const response = await axios.get(url, { timeout: 10000 });
          const data = response.data.data;
          let df = data.map(d => ({
              timestamp: moment.utc(parseInt(d[0])).toDate(),
              close: parseFloat(d[4])
          }));
          df.reverse(); // Reverse the data
          df = calculateEMA(df, 25);
          df = calculateSlope(df);
          return df;
      } catch (e) {
          console.log(`Error: ${e}`);
          await new Promise(resolve => setTimeout(resolve, 5000));
      }
  }
}

// Calculate EMA
function calculateEMA(df, period) {
  const closePrices = df.map(d => d.close);
  const ema = ti.EMA.calculate({ period: period, values: closePrices });

  return df.map((d, i) => ({
      ...d,
      ema25: i < period - 1 ? null : ema[i - (period - 1)]
  }));
}

// Calculate slope
function calculateSlope(df) {
  const window = 21;
  for (let i = window - 1; i < df.length; i++) {
      const slice = df.slice(i - (window - 1), i + 1);
      const slope = (slice[slice.length - 1].ema25 - slice[0].ema25) / 20 / df[i].close * 100;
      df[i].emaSlope = slope;
  }
  return df;
}

// Calculate 7-day price increase and drawdown
async function calculate7dPriceIncreaseAndDrawdown(symbols) {
  const resultData = {};
  const currentTime = moment.utc();
  for (const symbol of symbols) {
      const df = await getHistoricalKlines(symbol);
      if (df.length > 0) {
          const startTime = currentTime.clone().subtract(7, 'days');
          const df7d = df.filter(d => moment.utc(d.timestamp).isSameOrAfter(startTime));
          if (df7d.length > 0) {
              const lowestPrice = Math.min(...df7d.map(d => d.close));
              const highestPrice = Math.max(...df7d.map(d => d.close));
              const currentPrice = df7d[df7d.length - 1].close;
              const currentSlope = df7d[df7d.length - 1].emaSlope;
              const priceIncrease = ((currentPrice - lowestPrice) / lowestPrice) * 100;
              const drawdown = ((highestPrice - currentPrice) / highestPrice) * 100;
              resultData[symbol] = { increase: priceIncrease, currentPrice, drawdown: drawdown, scope: currentSlope };
          }
      }
  }
  return resultData;
}

// Get top 20 symbols by price increase
function getTop20PriceIncreaseSymbols(resultData) {
  const sortedIncreases = Object.entries(resultData).sort((a, b) => b[1].increase - a[1].increase);
  return sortedIncreases.slice(0, 20);
}

// Main function
async function main() {
  try {
    const symbols = await getSymbols();
    const resultData = await calculate7dPriceIncreaseAndDrawdown(symbols);
    const top20Symbols = getTop20PriceIncreaseSymbols(resultData);
    let HTML_DATA = ''
    top20Symbols.forEach(([symbol, data]) => {
      HTML_DATA += `\n<b>涨幅排名的币种</b>: <b>${symbol}</b> 当前价格 <b>${Number(data.currentPrice).toFixed(3)}</b>， 涨幅为 <b>${Number(data.increase).toFixed(3)}</b>，回撤为 <b>${Number(data.drawdown).toFixed(3)}</b>, 当前斜率 <b>${Number(data.scope).toFixed(3)}</b> \n`
    });
    return HTML_DATA
  } catch(err) {
    console.log('报错 \n', err)
    throw Error(err)
  }

}

module.exports = {
  getCryptoRanking: main
}