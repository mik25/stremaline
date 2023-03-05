const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const axios = require('axios');
const cheerio = require('cheerio');
const manifest = require('./manifest.json');

const builder = new addonBuilder(manifest);

const baseUrl = 'http://palined.com/search/opendir.html?blog=0&filetype=%252B%28.mkv%7C.mp4%7C.avi%7C.mov%7C.mpg%7C.wmv%29&string=';

builder.defineStreamHandler(async ({ type, id }) => {
    const url = `${baseUrl}${encodeURIComponent(id)}`;
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    const links = $('a[href$=".mkv"], a[href$=".mp4"], a[href$=".avi"], a[href$=".mov"], a[href$=".mpg"], a[href$=".wmv"]');
    const streams = links.toArray().map(link => ({
        title: $(link).text(),
        url: $(link).attr('href'),
        externalUrl: true,
    }));
    return { streams };
});

const addonInterface = builder.getInterface();

module.exports = serveHTTP(addonInterface);

const port = process.env.PORT || 5000;

if (!process.env.RENDER) {
    addonInterface.listen(port);
}
