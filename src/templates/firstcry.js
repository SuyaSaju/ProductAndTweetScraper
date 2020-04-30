const { getPhotoAsBuffer } = require('../utils')

const getBrandsByKeywords = async (browser, keywords) => {
  const page = await browser.newPage()
  const brands = []
  for (const keyword of keywords) {
    const searchUrl = 'https://www.firstcry.com/search?q=' + keyword.replace(' ', '+')
    await page.goto(searchUrl)
    await page.waitForSelector('body')
    try {
      await page.waitForSelector('#fltbrnd [class*="brandflt"]', { timeout: 3000 })
      const brandsInPage = await page.$$eval('#fltbrnd [class*="brandflt"] [class*="txt"]', (items) => {
        return items.map(item => item.innerText.trim())
      })
      brands.push(...(brandsInPage.filter(item => !brands.includes(item))))
    } catch (e) {
      console.log(e)
      console.log(`timeout waiting for brands on page with keywords: ${keyword}`)
    }
  }

  return brands
}

const searchProductsByKeywords = async (browser, keywords, maxResultsPerKeyword) => {
  // FirstCry is different to Amazon and Walmart, the all the search results appear in the same page as the user scrolls down.
  // So, the strategy to scrape the products is to scroll until the message that no more products are available appears, and then scan the whole page.
  const page = await browser.newPage()
  const productUrls = []
  for (const keyword of keywords) {
    const searchUrl = 'https://www.firstcry.com/search?q=' + keyword.replace(' ', '+')
    await page.goto(searchUrl)
    await page.waitForSelector('body')
    if ((await page.$('.lft.fw.urs_txt')) !== null) {
      // No results for this keyword, skip to the next
      productUrls.push([])
      continue
    }
    // Scroll until there are no more products or the threshold is achieved
    while (await page.$eval('.sc_key.fw.lft.nomoredivs', noMoreProductsMessage => noMoreProductsMessage.style.display === 'none')) {
      // Check if threshold has been reached
      const currentlyLoadedProducts = await page.$$eval('.list_block', products => products.map(p => p.querySelector('a')).filter(a => a.href !== 'javascript:void(0);').length)
      if (currentlyLoadedProducts >= maxResultsPerKeyword) {
        break
      }
      // Scroll to last product
      await page.evaluate("window.scrollTo(0,document.querySelectorAll('.list_block')[document.querySelectorAll('.list_block').length - 1].offsetTop);")
      // Wait for more products to load
      try {
        await page.waitForFunction(`Array.from(document.querySelectorAll('.list_block')).map(p => p.querySelector('a')).filter(a => a.href !== 'javascript:void(0);').length > ${currentlyLoadedProducts}`, { timeout: 6000 })
      } catch (e) {
        console.log('couldnt load more products')
      }
    }
    const keywordUrls = (
      await page.$$eval('.list_block', products => products
        .map(p => p.querySelector('a'))
        .filter(a => a.href !== 'javascript:void(0);' && a.href.match('firstcry.com/combopack') === null)
        .map(a => a.href))).map(url => url.split('?')[0])
      .slice(0, maxResultsPerKeyword)

    let currentRank = 0
    const rankedKeywordUrls = []
    for (const url of keywordUrls) {
      rankedKeywordUrls.push({ rank: ++currentRank, url })
    }
    productUrls[keyword] = rankedKeywordUrls
  }
  // Return all the urls of the products to scrape, grouped by origin keyword
  return productUrls
}

const getDetails = async (page) => {
  await page.waitForSelector('body')
  const result = await page.$eval('body', body => {
    const gtinMatch = body.innerText.match(/(?<=GTIN\/Barcode: )[0-9]*/)
    const gtin = (gtinMatch !== null && gtinMatch[0] !== '') ? gtinMatch[0] : null
    const id = body.querySelectorAll('#prod_short_info span').length > 0
      ? body.querySelectorAll('#prod_short_info span')[1].innerText.split(' ')[1]
      : document.location.href.match(/(?<=\?proid=)[0-9]*(?=&)/)[0]
    const priceEl = body.querySelector('#prod_price')
    return {
      id,
      gtin,
      source: 'firstcry.com',
      name: body.querySelector('.prod-name').innerText,
      description: body.querySelector('.p-prod-desc') ? body.querySelector('.p-prod-desc').innerHTML.split('<div')[0] : '',
      price: {
        amount: priceEl ? Number(priceEl.innerHTML.replace(',', '')) : 0,
        currency: '₹'
      }
    }
  })
  return result
}
const getDescriptionDetail = async (page) => {
  return null
}
const getPhotos = async (page) => {
  // First, click on the main image to open the image viewer popup
  await page.$eval('#big-img', bigImg => {
    bigImg.click()
  })
  const photos = []
  let lastPhoto = ''
  while (true) {
    // Wait for the page to load URL
    const isNewPhotoLoaded = `document.querySelector(".swiper-slide-active .zoom-popup-img") && document.querySelector(".swiper-slide-active .zoom-popup-img").src !== "${lastPhoto}"`
    try {
      await page.waitForFunction(isNewPhotoLoaded, { timeout: 5000 })
    } catch (e) {
      // Slider won't open, so return main image and move on
      console.log('slider not opened or image not changed. returning main image')
      lastPhoto = (await page.$eval('#big-img', bigImg => bigImg.src))
      return [
        {
          url: lastPhoto,
          data: await getPhotoAsBuffer(lastPhoto)
        }
      ]
    }
    // Get image source
    lastPhoto = await page.$eval('.swiper-slide-active .zoom-popup-img', image => {
      return image.src
    })
    photos.push({
      url: lastPhoto,
      data: await getPhotoAsBuffer(lastPhoto)
    })
    console.log('loaded photo')
    // Go to next page, if there is one
    if ((await page.$('.zoom-popup .swiper-button-next:not(.swiper-button-disabled)')) !== null) {
      await page.$eval('.zoom-popup .swiper-button-next', nextButton => nextButton.click())
    } else {
      console.log('no more images. returning ' + photos.length)
      break
    }
  }
  return photos
}
const getReviews = async (browser, page) => {
  const reviewsUrl = 'http://firstcry.com/reviews' + page.url().split('firstcry.com')[1].split('?')[0].replace(/product-detail$/, '')
  console.log('going to: ' + reviewsUrl)
  await page.goto(reviewsUrl)
  await page.waitForSelector('.div-big-star')
  const ratingLevels = await page.$$eval('[id^="ratestar"]', ratingLevels => ratingLevels.map(el => Number(el.attributes.title.value)))
  const overallRating = await page.$eval('.div-big-star.lft', bigStar => Number(bigStar.innerText))
  const ratingResult = {
    overall: overallRating,
    total: ratingLevels.reduce((sum, n) => sum + n, 0),
    fiveStars: ratingLevels[0],
    fourStars: ratingLevels[1],
    threeStars: ratingLevels[2],
    twoStars: ratingLevels[3],
    oneStars: ratingLevels[4]
  }
  // Return empty object if the product doesn't have reviews
  const totalReviews = await page.$eval('.div-ratings div:not([class]) div:not([class])', el => Number(el.innerText.split(' ')[3]))
  if (totalReviews === 0) {
    return {
      reviews: [],
      rating: ratingResult
    }
  }
  // Click "Load More" until all reviews are loaded in the current page
  while (await page.$eval('.p_r_all_reviews', loadMoreLink => loadMoreLink.style.display !== 'none')) {
    const totalReviewCount = await page.$$eval('.review-block', reviewEls => reviewEls.length)
    await page.evaluate('ReadAllReview()')
    await page.waitForFunction(`document.querySelectorAll('.review-block').length > '${totalReviewCount}'`)
  }

  const result = await page.$$eval('.review-block', reviewEls => {
    return reviewEls.map(r =>
      ({
        name: r.querySelector('.rev-name').innerText,
        rating: Number(r.querySelector('[itemprop="ratingValue"]').innerText),
        title: r.querySelector('.p1').innerText.replace(/"/g, ''),
        date: r.querySelector('.rev-time').innerText,
        isVerifiedPurchase: !!r.querySelector('.vb-tag'),
        textContent: r.querySelector('.p2').innerText,
        // Calculate positive minus negative feedback
        foundHelpful:
          Number(r.querySelector('.div-like').innerText) -
          Number(r.querySelector('.div-unlike').innerText)
      })
    )
  })
  return {
    reviews: result,
    rating: ratingResult
  }
}

module.exports = {
  searchProductsByKeywords,
  getBrandsByKeywords,
  getDetails,
  getDescriptionDetail,
  getPhotos,
  getReviews
}
