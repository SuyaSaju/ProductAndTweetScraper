// Base file for new templates. Use it to add a new site to scrape
// The "page" argument for all functions is a product page wrapped with Puppeteer

const searchProductsByKeywords = async (browser, keywords, maxResultsPerKeyword) => {
  return []
}

const initialSetup = async (page) => {

}

const getDetails = async (page) => {
  return {
    id: '',
    upc: '',
    // ... other identifiers
    source: '',
    name: '',
    description: '',
    price: {
      amount: 9.99,
      currency: '$'
    }
  }
}
const getDescriptionDetail = async (page) => {
  return ''
}
const getPhotos = async (page) => {
  return [{ url: '', data: Buffer.from('') }]
}
const getReviews = async (browser, page) => {
  return {
    reviews: [{ name: '', rating: 5, title: '', date: '', isVerifiedPurchase: true, textContent: '', foundHelpful: 1 }],
    rating: {
      overall: null,
      total: 0,
      fiveStars: 0,
      fourStars: 0,
      threeStars: 0,
      twoStars: 0,
      oneStars: 0
    }
  }
}

module.exports = {
  searchProductsByKeywords,
  initialSetup,
  getDetails,
  getDescriptionDetail,
  getPhotos,
  getReviews
}
