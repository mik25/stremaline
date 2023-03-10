const axios = require('axios');
const package = require('./package.json');

const manifest = {
  "id": "hy.od.org",
  "version": "1.0.0",
  "name": "Stremioline",
  "description": "Movie & TV Streams from Open Directories",
  "logo": "https://myimagedump.surge.sh/open.png",
  "resources": ["stream"],
  "types": ["movie", "series"],
  "idPrefixes": ["tt"],
  "catalogs": []
};

const { addonBuilder, serveHTTP, publishToCentral } = require('stremio-addon-sdk');

const addon = new addonBuilder(manifest);

function minTwoDigits(n) {
  return (n < 10 ? '0' : '') + n;
}

function toStream(meta) {
  return {
    title: meta.file + '\n' + meta.reg_date + (meta.filesize ? ' | ' + meta.filesize : '') + (meta.filetype ? ' | ' + meta.filetype : ''),
    url: meta.link.split('\\').join('')
  }
}

function noSpecialChars(str) {
  return str.replace(/[^\w\s]/gi, '').replace(/ {1,}/g, ' ').trim()
}

async function search(query) {
  try {
    const response = await axios.get(`https://www.google.com/search?q=${encodeURIComponent(query)}+${encodeURIComponent('intitle:"index of" -inurl:(jsp|pl|php|html|aspx|htm|cf|shtml) -inurl:(hypem|unknownsecret|sirens|writeups|trimediacentral|articlescentral|listen77|mp3raid|mp3toss|mp3drug|theindexof|index_of|wallywashis|indexofmp3)')}&num=50`);
    }
  } catch (error) {
    throw error;
  }
}

const cache = {};

addon.defineStreamHandler(async (args) => {
  if (cache[args.id]) {
    return { streams: cache[args.id] };
  }
  try {
    const response = await axios.get('https://v3-cinemeta.strem.io/meta/' + args.type + '/' + args.id.split(':')[0] + '.json');
    const body = response.data;
    if (body && body.meta) {
      let query = body.meta.name.toLowerCase();

      if (args.type == 'series' && args.id.includes(':')) {
        const idParts = args.id.split(':')
        query += ' s'+minTwoDigits(idParts[1])+'e'+minTwoDigits(idParts[2])
      }

      function respond(streams) {
        cache[args.id] = streams;
        setTimeout(() => {
          delete cache[args.id];
        }, 86400000)
        return { streams, cacheMaxAge: 86400 }; // cache for 1 day
      }
      const streams = await search(encodeURIComponent(query));
      return respond(streams);
    } else {
      throw new Error('Invalid response from Cinemeta');
    }
  } catch (error) {
    // try removing special chars from query
    if (query != noSpecialChars(query)) {
      const streams = await search(encodeURIComponent(noSpecialChars(query)));
      return respond(streams);
    } else {
      throw error;
    }
  }
});

const interface = addon.getInterface();

serveHTTP(interface, { port: process.env.PORT || 7777, hostname: '0.0.0.0' });
console.log(`Addon running at: http://0.0.0.0:${process.env.PORT || 7777}/stremioget/stremio/v1`);
