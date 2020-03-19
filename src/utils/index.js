const https = require('https')

const getPhotoAsBuffer = async (url) => {
  const buffer = await (new Promise((resolve) => {
    https.get(url, (res) => {
      const imageSize = Number(res.headers['content-length'])
      const isTooLarge = imageSize >= 16000000
      if (isTooLarge) {
        // Image is larger than 16 MB, return empty buffer
        resolve(Buffer.from(''))
      } else {
        let imageBuffer = Buffer.from('')
        res.on('data', (data) => {
          imageBuffer = Buffer.concat([imageBuffer, data])
        })
        res.on('end', () => {
          resolve(imageBuffer)
        })
      }
    }).on('error', (e) => {
      console.error(e)
    })
  }))
  return buffer
}

const getZipCodeFromExtension = (extension) => {
  switch (extension) {
    case 'com': // USA
      // New York
      return '10001'
    case 'co.uk': // UK
      // London
      return 'WC2N 5DU'
    case 'ca': // Canada (double input field)
      // Terranova
      return 'A1A 1A1'
    case 'in': // India
      // New Delhi
      return '110098'
    case 'sg': // Singapore
      // New Bridge
      return '059381'
    case 'ae': // United Arab Emirates (dropdown selection)
      // Dubai
      return 'Dubai'
    default:
      return null
  }
}

module.exports = {
  getPhotoAsBuffer,
  getZipCodeFromExtension
}
