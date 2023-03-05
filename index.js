// Import required modules
const axios = require('axios');
const cheerio = require('cheerio');
const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');

// Define addon manifest
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

// Create addon builder instance
const addon = new addonBuilder(manifest);

// Define function to convert meta data to stream object
function toStream(meta) {
  return {
    title: meta.file + '\n' + meta.reg_date + (meta.filesize ? ' | ' + meta.filesize : '') + (meta.filetype ? ' | ' + meta.filetype : ''),
    url: meta.link.split('\\').join('')
  }
}

// Define function to extract data from HTML response
function extractDataFromHTML(html) {
  const $ = cheerio.load(html);
  const rows = $('tr').slice(1);
  const streams = rows.map((i, el) => {
    const tds = $(el).find('td');
    const file = $(tds[0]).find('a').text().trim();
    const link = $(tds[0]).find('a').attr('href').trim();
    const reg_date = $(tds[1]).text().trim();
    const filesize = $(tds[2]).text().trim();
    const filetype = $(tds[3]).text().trim();
    return { file, link, reg_date, filesize, filetype };
  }).get();
  return streams;
}

// Define search function to query open directories
async function search(query) {
  try {
    const response = await axios.post('https://opendirectories-api.herokuapp.com/api/search', {
      query,
      filetype: ['mkv', 'mp4', 'avi', 'mov', 'mpg', 'wmv'],
      site: ['palined.com', 'hi10anime.com']
    });
    const urls = response.data.urls;
    const htmlResponses = await Promise.all(urls.map(url => axios.get(url)));
    const streamLists = htmlResponses.map(response => extractDataFromHTML(response.data));
    const streams = streamLists.flat().map(toStream);
    console.log(`Found ${streams.length} streams for query '${query}'`);
    return streams;
  } catch (err) {
    throw err;
  }
}

// Define function to handle stream requests
addon.defineStreamHandler(args => {
  return new Promise((resolve, reject) => {
    const cacheKey = `${args.type}:${args.id}`;
    if (cache[cacheKey]) {
      resolve({ streams: cache[cacheKey] });
      return;
    }
    // Fetch meta data for the content
axios.get(`https://v3-cinemeta.strem.io/meta/${args.type}/${args.id.split(':')[0]}.json`)
  .then(response => {
    const meta = response.data.meta;
    let query = meta.name.toLowerCase();
    
    // If the content is a series, append season and episode number to query
    if (args.type == 'series' && args.id.includes(':')) {
      const idParts = args.id.split(':')
      query += ' s'+minTwoDigits(idParts[1])+'e'+minTwoDigits(idParts[2])
    }

    // Search for streams using query
    search(encodeURIComponent(query)).then(streams => {
      cache[cacheKey] = streams;
      setTimeout(() => {
        delete cache[cacheKey];
      }, 86400000)
      resolve({ streams, cacheMaxAge: 86400 }); // cache for 1 day
    }).catch(err => {
      // try removing special chars from query
      if (query != noSpecialChars(query)) {
        search(encodeURIComponent(noSpecialChars(query))).then(streams => {
          cache[cacheKey] = streams;
          setTimeout(() => {
            delete cache[cacheKey];
          }, 86400000)
          resolve({ streams, cacheMaxAge: 86400 }); // cache for 1 day
        }).catch(err => {
          reject(err);
        })
      } else {
        reject(err);
      }
    })
  })
  .catch(err => {
    reject(err);
  });
  });
addon.defineStreamHandler(args => {
return new Promise((resolve, reject) => {
const cacheKey = ${args.type}:${args.id};
if (cache[cacheKey]) {
resolve({ streams: cache[cacheKey] });
return;
}
// Get meta info
const response = await axios.get(`https://v3-cinemeta.strem.io/meta/${args.type}/${args.id.split(':')[0]}.json`);
const meta = response.data.meta;
let query = meta.name.toLowerCase();

// try removing special chars from query
if (query != noSpecialChars(query)) {
  search(encodeURIComponent(noSpecialChars(query))).then(streams => {
    cache[cacheKey] = streams;
    setTimeout(() => {
      delete cache[cacheKey];
    }, 86400000)
    resolve({ streams, cacheMaxAge: 86400 }); // cache for 1 day
  }).catch(err => {
    reject(err);
  })
} else {
  reject(err);
}
})
.catch(err => {
reject(err);
});
});

// Define addon interface
const interface = addon.getInterface();

// Start addon server
serveHTTP(interface, { port: process.env.PORT || 7777, hostname: '0.0.0.0' });
console.log(`Addon running at: http://0.0.0.0:${process.env.PORT || 7777}/stremioget/stremio/v1`);
