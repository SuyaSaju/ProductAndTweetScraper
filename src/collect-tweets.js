const axios = require('axios').default
const Twitter = require('twitter')
const connectDB = require('./db/connect')
const twitterConfig = require('../config/twitter-config.json')
const Product = require('./db/models/product').model
const CONSUMER_KEY = process.env.CONSUMER_KEY
const CONSUMER_SECRET = process.env.CONSUMER_SECRET
const { numberOfTweets } = twitterConfig
const tweetsCache = new Map()
let twitterClient

const getBearerToken = async () => {
  const encodedKey = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64')
  try {
    const { data } = await axios.post('https://api.twitter.com/oauth2/token?grant_type=client_credentials', {},
      { headers: { Authorization: `Basic ${encodedKey}` } })
    return data.access_token
  } catch (e) {
    console.log(`Can not fetch tweets. Unable to generate bearer token ${e}`)
    process.exit(1)
  }
}

const getTwitterClient = async () => {
  if (twitterClient) return twitterClient
  const bearerToken = await getBearerToken()
  return new Twitter({
    consumer_key: CONSUMER_KEY,
    consumer_secret: CONSUMER_SECRET,
    bearer_token: bearerToken
  })
}

const getTweetsFor = async (searchQuery) => {
  if (tweetsCache.has(searchQuery)) {
    return tweetsCache.get(searchQuery)
  }
  const client = await getTwitterClient()
  return new Promise(resolve => {
    client.get('search/tweets', { q: encodeURIComponent(searchQuery), count: numberOfTweets }, function (error, tweets) {
      if (error) {
        console.log(`Fetching for ${searchQuery} failed... Skipping!`)
        return resolve([])
      }
      const tweetTexts = tweets.statuses.map(item => item.text)
      tweetsCache.set(searchQuery, tweetTexts)
      return resolve(tweetTexts)
    })
  })
}

const getProductGroup = (name, brand) => {
  const processedName = name
    .replace(new RegExp('\\b(' + brand + ')\\b', 'gi'), '') // Remove brand
    .replace(/ *\([^)]*\) */g, '') // Remove text within paranthesis
    .replace(/(\d*\.)?\d+/g, '') // Remove numbers
    .trimStart()
    .split(',')[0]
  return processedName.split(' ').slice(0, 3).join(' ')
}

const getKeywords = (product) => {
  const topics = [...product.topics.positives, ...product.topics.negatives]
  const group = getProductGroup(product.name, product.brand)
  let baseKeyword = product.brand || group
  if (product.brand && group) baseKeyword = product.brand + ' OR ' + group
  if (!topics.length) return [baseKeyword]
  return topics.map(topic => baseKeyword + ' OR ' + topic)
}

const getTweets = async (product) => {
  const keywords = getKeywords(product)
  const tweets = await Promise.all(keywords.map(keyword => getTweetsFor(keyword)))
  return tweets.flat()
}

const updateTweetsInProduct = async (tweets, product) => {
  await Product.updateOne({ _id: product._id }, { $set: { socialMedia: { twitter: tweets } } })
}

const mainProcess = async () => {
  await connectDB()
  const products = await Product.find()
  await Promise.all(products.map(async (product) => {
    console.log(`Fetching tweets for product with id ${product._id}`)
    const tweets = await getTweets(product)
    if (tweets.length) {
      await updateTweetsInProduct(tweets, product)
      console.log(`Tweets updated for product ${product._id}`)
    }
  }))
  process.exit(0)
}

mainProcess()
