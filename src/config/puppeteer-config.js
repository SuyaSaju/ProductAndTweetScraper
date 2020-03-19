module.exports = {
  headless: false,
  executablePath: process.env.CHROME_BIN || null,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-gpu',
    '--window-size=1920,1080',
    '--page-size=1920,1080',
    '--user-agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/65.0.3312.0 Safari/537.36"'
  ]
}
