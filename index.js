const cheerio = require('cheerio')
const readline = require('readline');
const ytdl = require('ytdl-core')
const ffmpeg = require('fluent-ffmpeg');

function sanitizeFileName(filename) {
  const reservedChars = /[<>:"/\\|?*]/g
  const sanitizedFilename = filename.replace(reservedChars, '_').replace(/\s+/g, '_').replace(/^\.+/, '')
  return sanitizedFilename
}

// note, please create folder ffmpeg to store binary of ffmpeg
// note, please create folder downloaded to store downloaded mp3

function getMP3(id, options) {
  const { name, outputFolder, ffmpegPath } = options

  let stream = ytdl(id, {
    quality: 'highestaudio',
  });

  if (!name || name === '') {
    ytdl.getBasicInfo(id).then(info => {
      name = sanitizeFileName(info.videoDetails.title);
    });
  }

  let start = Date.now();
  ffmpeg(stream)
    .setFfmpegPath(ffmpegPath ?? './ffmpeg/bin/ffmpeg.exe')
    .save(`${outputFolder ?? __dirname}/${name ?? id}.mp3`)
    .on('progress', p => {
      readline.cursorTo(process.stdout, 0);
      process.stdout.write(`${p.targetSize}kb (${name} - (${id})) downloaded`);
    })
    .on('end', () => {
      console.log(`\(${name} - (${id})), downloaded - ${(Date.now() - start) / 1000}s`);
    });
}

async function getYoutubePlaylist(url) {
  if (url.includes('music.youtube.com')) {
    url = url.replace('music.youtube.com', 'www.youtube.com')
  }

  try {
    const headers = {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36',
    }

    const getPlaylist = []
    const response = await fetch(url, { headers })
    const data = await response.text()
    const $ = cheerio.load(data)

    const getYtInitialData = JSON.parse(
      $('script:contains("var ytInitialData")')
        .text()
        .split('var ytInitialData = ')[1]
        .split(';')[0],
    )

    const playlistContent =
      getYtInitialData.contents.twoColumnBrowseResultsRenderer.tabs[0]
        .tabRenderer.content.sectionListRenderer.contents[0].itemSectionRenderer
        .contents[0].playlistVideoListRenderer.contents

    playlistContent.forEach((item) => {
      if (item.playlistVideoRenderer) {
        getPlaylist.push({
          ytVidId: item.playlistVideoRenderer.videoId,
          ytLink: `https://www.youtube.com/watch?v=${item.playlistVideoRenderer.videoId}`,
          ytTitle: sanitizeFileName(
            item.playlistVideoRenderer.title.runs[0].text,
          ),
        })
      }
    })

    console.log(`Get ${getPlaylist.length} video(s)`)
    return getPlaylist
  } catch (error) {
    console.error(error)
  }
}

async function downloadYoutubePlaylistMp3(url) {
  const playlistURL = await getYoutubePlaylist(url)
  const promises = playlistURL.map(async (item, index) => {
    await new Promise((resolve) => setTimeout(resolve, 5 * 1000))
    try {
      getMP3(item.ytVidId, { name: item.ytTitle, outputFolder: './downloaded' })
    } catch (error) {
      console.error(`${index+1}. Error when downloading a video ${item.ytTitle} (${item.ytLink}): `, error)
    }
  })
  await Promise.all(promises)
}

function downloadYoutubeMp3(url) {
  const youtubeURLParams = new URLSearchParams(url)
  const ytVidId = youtubeURLParams.get('https://www.youtube.com/watch?v')
  try {
    getMP3(ytVidId, { outputFolder: './downloaded' })
  } catch (error) {
    console.error(`${1}. Error when downloading a video ${youtubeURLParams} (${item?.ytLink}): `, error)
  }
}

// usage

// Youtube Music Album/Playlist
(async() => {
  downloadYoutubePlaylistMp3("https://music.youtube.com/playlist?list=OLAK5uy_le0yxWXsv9FFR34JFe6BdkMFTeVWYcUpo")
})()

// Youtube Playlist
(async() => {
  downloadYoutubePlaylistMp3("https://www.youtube.com/playlist?list=PLRCVKvN8K6Sa5HDzSB6dr_BSTBsqh1NOH")
})()

// Single Youtube Video
downloadYoutubeMp3('https://www.youtube.com/watch?v=_CV5wVHjMfQ')