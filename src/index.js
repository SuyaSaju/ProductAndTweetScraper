const puppeteer = require('puppeteer')

const puppeteerConfig = require('./config/puppeteer-config')
const connectDB = require('./db/connect')
const Product = require('./db/models/product').model

// Process configuration file
let sites, maxProductsPerKeyword, enableVerificationApi, retries
if (process.env.CONFIG_FILE && !isNaN(Number(process.env.CONFIG_FILE))) {
  const configFileNumber = Number(process.env.CONFIG_FILE)
  try {
    const jsonConfig = require(`../config/config${configFileNumber}.json`)
    sites = jsonConfig.sites
    maxProductsPerKeyword = Number(jsonConfig.maxProductsPerKeyword)
    enableVerificationApi = jsonConfig.verificationApi
    retries = Number(jsonConfig.retries)
  } catch (e) {
    console.log(e)
    console.log()
    console.log(`Invalid configuration file at './config/config${configFileNumber}'.json`)
    process.exit(0)
  }
} else {
  console.log('CONFIG_FILE environment variable is not defined or is not a valid number')
  process.exit(0)
}

if (sites.some(site => site.url.match(/(amazon|walmart|firstcry)/g) === null)) {
  console.log('Sites to scrape must be: Amazon, Walmart or FirstCry')
  process.exit(0)
}

if (sites.some(site => site.url.startsWith('amazon') && site.url.replace(/\w*./, '').match(/(com|co.uk|ca|in|sg|ae)/g) === null)) {
  console.log('Amazon sites must on of these: "amazon.com", "amazon.co.uk", "amazon.ca", "amazon.in", "amazon.sg", "amazon.ae"')
  process.exit(0)
}

if (isNaN(maxProductsPerKeyword)) {
  console.log('"maxProductsPerKeyword" must be a valid number')
  process.exit(0)
}

if (isNaN(retries)) {
  console.log('"retries" must be a valid number')
  process.exit(0)
}

// How many times to retry when an error happens
const RETRIES = retries
const RETRIES_ARRAY = []
for (let i = 0; i < RETRIES; i++) { RETRIES_ARRAY.push(i) }

const scrapeProductDetailsFromUrl = async (browser, page, url, template) => {
  await page.goto(url)
  await page.waitForSelector('body')
  console.log('Scraping', url)
  // Get product details
  console.log('Getting details...')
  let productDetails = await template.getDetails(page)
  // Get description detail
  productDetails.descriptionDetail = await template.getDescriptionDetail(page)
  // Get photos
  console.log('Getting photos...')
  productDetails.photos = await template.getPhotos(page)
  // Get reviews and rating information, must be always last because it changes the current page
  console.log('Getting reviews and rating...')
  productDetails = {
    ...productDetails,
    ...(await template.getReviews(browser, page))
  }
  console.log('Finished scraping of', url)
  return productDetails
}

const scrapeProductDetails = async (keywordsResultsToScrape, template) => {
  // Use current timestamp as ID for this run of the scraping tool
  const scraperRunId = String(Date.now())
  const browser = await puppeteer.launch(puppeteerConfig)
  const page = await browser.newPage()
  let totalProductsScraped = 0
  let currentProduct = 1
  const totalResults = keywordsResultsToScrape.reduce((sum, kR) => sum + kR.reduce((sum, url) => sum + 1, 0), 0)
  for (const keywordResults of keywordsResultsToScrape) {
    for (const url of keywordResults) {
      console.log()
      console.log(`Scraping product ${currentProduct} of ${totalResults}`)
      let res
      for (const attempt in RETRIES_ARRAY) {
        try {
          res = (await scrapeProductDetailsFromUrl(browser, page, url, template))
          res.lastUpdated = String(Date.now())
          res.productUrl = url
          // Conditions to check if product is already in the database from previous runs
          const conditions = []
          if (res.upc) {
            conditions.push({ upc: res.upc })
          }
          if (res.sku) {
            conditions.push({ sku: res.sku })
          }
          if (res.gtin) {
            conditions.push({ gtin: res.gtin })
          }
          if (res.asin) {
            conditions.push({ asin: res.asin })
          }
          let updatedProduct = null
          if (conditions.length > 0) {
            // Update a product if any of the unique identifiers coincide and the current details of the database are from a past run
            updatedProduct = await Product.findOneAndUpdate({ scraperRunId: { $ne: scraperRunId }, $or: conditions }, res)
          }
          // If the product didn't exist from previous runs, create it now
          if (updatedProduct === null) {
            await Product.create({
              ...res,
              scraperRunId
            })
          }
          totalProductsScraped += 1
          break
        } catch (e) {
          console.log(e)
          const attemptsLeft = RETRIES - 1 - attempt
          if (attemptsLeft === 0) {
            console.log('Error retrieving product details, skipping...')
          } else {
            console.log(`Error retrieving product details, retrying ${attemptsLeft} more time(s)...`)
          }
        }
      }
      currentProduct += 1
    }
  }
  await browser.close()
  return totalProductsScraped
}

const mainProcess = async () => {
  // Connect to MongoDB
  await connectDB()

  if (enableVerificationApi) {
    require('./verification-api')()
  }

  const browser = await puppeteer.launch(puppeteerConfig)
  let totalProductsScraped = 0

  for (const site of sites) {
    console.log()
    console.log(`Scraping site ${sites.indexOf(site) + 1} of ${sites.length} total sites`)
    console.log()
    const baseSite = site.url.split('.')[0]
    const template = require('./templates/' + baseSite)

    let urlsByKeyword
    for (const attempt in RETRIES_ARRAY) {
      try {
        console.log(`Scraping search results from "${site.url}"...`)
        urlsByKeyword = (await template.searchProductsByKeywords(browser, site.keywords, maxProductsPerKeyword, site.url.replace(/\w*./, '')))
        console.log('Scraping products...')
        totalProductsScraped += await scrapeProductDetails(urlsByKeyword, template)
        break
      } catch (e) {
        console.log(e)
        const attemptsLeft = RETRIES - 1 - attempt
        if (attemptsLeft === 0) {
          console.log('Error retrieving search results, skipping...')
        } else {
          console.log(`Error retrieving search results, retrying ${attemptsLeft} more time(s)...`)
        }
      }
    }
  }
  await browser.close()
  const totalSites = sites.length
  const totalKeywords = sites.reduce((sum, site) => sum + site.keywords.length, 0)
  console.log(`Scraping finished. Scraped ${totalProductsScraped} products from ${totalKeywords} keywords and ${totalSites} sites`)
  process.exit(0)
}

mainProcess()
