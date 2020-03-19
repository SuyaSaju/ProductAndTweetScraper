/* eslint-disable no-async-promise-executor */
const { getPhotoAsBuffer } = require('../utils')

const searchProductsByKeywords = async (browser, keywords, maxResultsPerKeyword) => {
  const page = await browser.newPage()
  const productUrls = []
  for (const keyword of keywords) {
    const searchUrl = 'https://www.walmart.com/search/?query=' + keyword.replace(' ', '+')
    await page.goto(searchUrl)
    await page.waitForSelector('body')
    if ((await page.$('span.zero-results-message')) !== null) {
      // No results for this keyword, skip to the next
      productUrls.push([])
      continue
    }
    const keywordUrls = []
    while (true) {
      await page.waitForSelector('.search-result-gridview-item')
      const productsInPage = await page.$$eval('.search-result-gridview-item', (products) => {
        return products
          // Extract product URLs from links
          .map(el => el.querySelector('a').href)
          // Filter temporal offers
          .filter(url => url.match('walmart.com/ip/') !== null)
      })
      if (keywordUrls.length + productsInPage.length > maxResultsPerKeyword) {
        keywordUrls.push(...productsInPage.slice(0, maxResultsPerKeyword - keywordUrls.length))
        break
      } else if ((await page.$('.paginator-btn.paginator-btn-next')) === null) {
        // No more results
        keywordUrls.push(...productsInPage)
        break
      }
      keywordUrls.push(...productsInPage)
      // Move to next page
      const totalIFrames = (await page.$$eval('iframe', frames => frames.length))
      await page.$eval('.paginator-btn.paginator-btn-next', nextButton => nextButton.click())
      await page.waitForFunction(`document.querySelectorAll('iframe').length > ${totalIFrames}`)
    }
    productUrls.push(keywordUrls)
  }
  // Return all the urls of the products to scrape, grouped by origin keyword
  return productUrls
}

const getDetails = async (page) => {
  await page.waitForSelector('body')
  if ((await page.$('header.error-page__header')) !== null) {
    await page.evaluate('window.location.reload(true);')
    await page.waitForNavigation()
  }
  const result = await page.$eval('body', body => {
    const url = document.location.href
    const walmartId = url.match(/([0-9]{8,10})/)[0]
    const upcMatch = body.innerHTML.match(/(?<="displayName":"UPC","displayValue":")(?=")/)
    const upc = (upcMatch !== null && upcMatch[0] !== '') ? upcMatch[0] : null
    const gtin = body.querySelector('span[itemprop="gtin13"]') ? body.querySelector('span[itemprop="gtin13"]').attributes.content.value : null
    // eslint-disable-next-line
    const priceStr = body.querySelector('span[class*="price"] .visuallyhidden').innerText.replace(/(^ | $)| /g, '')
    return {
      sku: walmartId,
      upc,
      gtin,
      source: 'walmart.com',
      name: body.querySelector('.prod-ProductTitle').innerText,
      description: body.querySelector('.about-desc') ? body.querySelector('.about-desc').innerHTML : '',
      price: {
        amount: Number(
          priceStr
            .replace(/(?![0-9,.]).{1}/g, '')
            .replace(/(,)(?=([0-9]{0,2}$))/, '.')
            .replace(/(\.|,)(?!([0-9]{0,2}$))/g, '')
        ),
        currency: priceStr.replace(/[0-9,.]/g, '')
      }
    }
  })
  return result
}
const getDescriptionDetail = async (page) => {
  let result = ''
  // Check for Ingredients
  if ((await page.$('p.Ingredients')) !== null) {
    result += await page.$eval('p.Ingredients', ingredientsEl => ingredientsEl.outerHTML)
  }
  // Check for Instructions
  if ((await page.$('p.Directions')) !== null) {
    result += await page.$eval('p.Directions', directionsEl => directionsEl.outerHTML)
  }
  // Check for Nutrition
  if ((await page.$('.nutrition-facts.Grid')) !== null) {
    result += await page.$eval('.nutrition-facts.Grid', nutritionEl => nutritionEl.outerHTML)
  }
  return result
}

const getPhotos = async (page) => {
  await page.waitForSelector('.prod-hero-image img')
  const photos = []
  const photosUrls = await page.$$eval('.slider-list img.prod-alt-image-carousel-image', async (thumbnails) => {
    let lastPhoto = ''
    const urls = []
    for (const thumb of thumbnails) {
      thumb.click()
      urls.push(await new Promise(async (resolve, reject) => {
        let counter = 0
        while (true) {
          if (document.querySelector('.prod-hero-image img').src === lastPhoto) {
            if (counter > 10000) {
              reject(new Error('Photo UI timeout'))
              break
            } else {
              counter += 25
              await new Promise(resolve => setTimeout(() => resolve(), 25))
            }
          } else {
            lastPhoto = document.querySelector('.prod-hero-image img').src
            resolve(lastPhoto.split('?')[0])
            break
          }
        }
      }))
    }
    return urls
  })
  for (const url of photosUrls) {
    photos.push({
      url,
      data: await getPhotoAsBuffer(url)
    })
  }
  return photos
}
const getReviews = async (browser, page) => {
  const url = page.url()
  const walmartId = url.match(/([0-9]{8,10})/)[0]
  await page.goto(`https://www.walmart.com/reviews/product/${walmartId}`)
  await page.waitForSelector('.star')
  // Return empty array if the product doesn't have reviews
  const hasReviews = await page.$('.pagination-container span')
  const hasRatings = await page.$('.RatingFilter')
  let ratingResult
  if (hasRatings) {
    const ratingLevels = await page.$$eval('.RatingFilter', ratingLevels => ratingLevels.map(el => Number(el.attributes['aria-label'].value.split(' ')[0])))
    ratingResult = {
      overall: Number(await page.$eval('.product-review-ratings span', overallEl => overallEl.innerText)),
      total: ratingLevels.reduce((sum, n) => sum + n, 0),
      fiveStars: ratingLevels[0],
      fourStars: ratingLevels[1],
      threeStars: ratingLevels[2],
      twoStars: ratingLevels[3],
      oneStars: ratingLevels[4]
    }
  } else {
    ratingResult = {
      overall: null,
      total: 0,
      fiveStars: 0,
      fourStars: 0,
      threeStars: 0,
      twoStars: 0,
      oneStars: 0
    }
  }
  if (!hasReviews) {
    return {
      reviews: [],
      ratings: ratingResult
    }
  }
  const result = []
  let lastReviews = ''
  while (true) {
    // Wait for next page to load
    await page.waitForFunction(`document.querySelector('.pagination-container span').innerText.split(' ')[0] !== '${lastReviews}'`)
    await page.waitForSelector('.pagination-container span')
    const reviews = await page.$$eval('.product-review div[class=""] .Grid.ReviewList-content', reviewEls => {
      return reviewEls.map(r =>
        ({
          name: r.querySelector('.review-footer-userNickname').innerText.replace(/, $/, ''),
          rating: Number(r.querySelector('.seo-avg-rating').innerText),
          title: r.querySelector('h3') ? r.querySelector('h3').innerText : '',
          date: r.querySelector('.review-footer-submissionTime').innerText,
          isVerifiedPurchase: !!r.querySelector('.review-badge'),
          textContent: r.querySelector('.review-description p') ? r.querySelector('.review-description p').innerText : '',
          // Calculate positive minus negative feedback
          foundHelpful:
            Number(r.querySelectorAll('.yes-no-count')[0].innerText) -
            Number(r.querySelectorAll('.yes-no-count')[1].innerText)
        })
      )
    })
    result.push(...reviews)
    // Record current review range
    lastReviews = await page.$eval('.pagination-container span', el => el.innerText.split(' ')[0])
    // Go to next page, if there is one
    if ((await page.$('.product-review-footer .paginator-btn-next')) !== null) {
      await page.$eval('.product-review-footer .paginator-btn-next', nextButton => nextButton.click())
    } else {
      break
    }
  }
  return {
    reviews: result,
    rating: ratingResult
  }
}

module.exports = {
  searchProductsByKeywords,
  getDetails,
  getDescriptionDetail,
  getPhotos,
  getReviews
}
