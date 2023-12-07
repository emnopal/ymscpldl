const YoutubeMp3Downloader = require("youtube-mp3-downloader");
const axios = require('axios');
const cheerio = require('cheerio');

// note, please create folder ffmpeg to store binary of ffmpeg
// note, please create folder downloaded to store downloaded mp3

class Downloader {

    constructor() {

        var self = this;

        //Configure YoutubeMp3Downloader with your settings
        self.YD = new YoutubeMp3Downloader({
            "ffmpegPath": "./ffmpeg/bin/ffmpeg.exe", // FFmpeg binary location, download here: https://www.ffmpeg.org/download.html
            "outputPath": "./downloaded", // Output file location (default: the home directory)
            "youtubeVideoQuality": "highestaudio", // Desired video quality (default: highestaudio)
            "queueParallelism": 4, // Download parallelism (default: 1)
            "progressTimeout": 2000, // Interval in ms for the progress reports (default: 1000)
            "outputOptions": ["-af", "silenceremove=1:0:-50dB"] // Additional output options passend to ffmpeg
        });

        self.callbacks = {};

        self.YD.on("finished", function (error, data) {

            if (self.callbacks[data.videoId]) {
                self.callbacks[data.videoId](error, data);
            } else {
                console.log("Error: No callback for videoId!");
            }

        });

        self.YD.on("error", function (error, data) {

            console.error(error + " on videoId " + data.videoId);

            if (self.callbacks[data.videoId]) {
                self.callbacks[data.videoId](error, data);
            } else {
                console.log("Error: No callback for videoId!");
            }

        });

    }

    getMP3(track, callback) {

        var self = this;

        // Register callback
        self.callbacks[track.videoId] = callback;
        // Trigger download
        self.YD.download(track.videoId, track?.name);

    }
}

function sanitizeFileName(filename) {
    const reservedChars = /[<>:"/\\|?*]/;
    const sanitizedFilename = filename.replace(reservedChars, '_');
    const finalFilename = sanitizedFilename.replace(/^\.+/, '');
    return finalFilename;
}

async function getYoutubePlaylist(url) {

    try {
        const headers = {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "Accept-Language": "en-US,en;q=0.9",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36",
        }

        // https://www.youtube.com/playlist?list=PLZWwPQXRlvoxIosqJxCC9LwcwJtrnx5Eh

        // const {data} = await axios.get('https://www.youtube.com/playlist?list=PLqWr7dyJNgLKAYaH8YO0QHPSX-G8tO5lF', {
        //     headers
        // })

        const { data } = await axios.get(url, {
            headers
        })

        const $ = cheerio.load(data);

        const getYtInitialData = JSON.parse($('script:contains("var ytInitialData")').text()
            .split('var ytInitialData = ')[1].split(';')[0])

        const playlistContent = getYtInitialData.contents.twoColumnBrowseResultsRenderer.tabs[0]
            .tabRenderer.content.sectionListRenderer.contents[0]
            .itemSectionRenderer.contents[0]
            .playlistVideoListRenderer.contents

        const getPlaylist = []

        playlistContent.forEach(item => {
            getPlaylist.push({
                ytVidId: item.playlistVideoRenderer.videoId,
                ytLink: `https://www.youtube.com/watch?v=${item.playlistVideoRenderer.videoId}`,
                ytTitle: sanitizeFileName(item.playlistVideoRenderer.title.runs[0].text),
            })
        })

        return getPlaylist

    } catch (error) {
        console.error(error);
    }
}

async function downloadYoutubePlaylistMp3(url) {

    const playlistURL = await getYoutubePlaylist(url)

    var dl = new Downloader();
    var i = 0;

    playlistURL.forEach(item => {
        dl.getMP3({ videoId: item.ytVidId }, function (err, res) {
            i++;
            if (err)
                console.log("Song " + i + " wasn't downloaded: " + res.file + ' because of this error: ', err)
            else {
                console.log("Song " + i + " was downloaded: " + res.file);
            }
        });
    })
}

async function downloadYoutubeMp3(url) {

    const youtubeURLParams = new URLSearchParams(url);
    const ytVidId = youtubeURLParams.get('https://www.youtube.com/watch?v');

    var dl = new Downloader();
    var i = 0;

    dl.getMP3({ videoId: ytVidId }, function (err, res) {
        i++;
        if (err)
            console.log("Song " + i + " wasn't downloaded: " + res.file + ' because of this error: ', err)
        else {
            console.log("Song " + i + " was downloaded: " + res.file);
        }
    })
}

// usage

// (async() => {
//     downloadYoutubeMp3('https://www.youtube.com/watch?v=_CV5wVHjMfQ&pp=ygUcdXRhIG5pIGthdGFjaGkgd2EgbmFpIGtlcmVkbw%3D%3D')
// })()

// (async() => {
//     downloadYoutubePlaylistMp3('https://www.youtube.com/playlist?list=PLZWwPQXRlvoxIosqJxCC9LwcwJtrnx5Eh')
// })()