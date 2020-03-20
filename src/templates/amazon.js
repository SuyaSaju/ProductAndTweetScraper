const { getPhotoAsBuffer, getZipCodeFromExtension } = require('../utils')

const initialSetup = async (page) => {
  const domainExtension = page.url().replace('https://www.amazon.', '').split('/')[0]
  const zipCode = getZipCodeFromExtension(domainExtension)
  // Check if location needs to be changed. If so, open set it to a zip code from the country.
  if ((await page.$eval('#glow-ingress-line2', el => el.innerText)).match(zipCode) === null) {
    // Open dialog to change delivery location
    await page.$eval('#nav-global-location-slot a', changeLocationEl => {
      changeLocationEl.click()
    })
    if (domainExtension === 'ca') { // Canada Site
      await page.waitForSelector('.GLUX_Inline [aria-labelledby="GLUXZipUpdate-announce"]')
      await page.evaluate((locationForm, zipCode) => {
        locationForm.querySelector('#GLUXZipUpdateInput_0').value = zipCode.split(' ')[0]
        locationForm.querySelector('#GLUXZipUpdateInput_1').value = zipCode.split(' ')[1]
      }, await page.$('#GLOWFeature_AddressList'), zipCode)
      while (true) {
        try {
          await page.$eval('[aria-labelledby="GLUXZipUpdate-announce"]', applyButton => {
            applyButton.click()
          })
          await new Promise(resolve => setTimeout(resolve, 25))
        } catch (e) {
          break
        }
      }
    } else if (domainExtension === 'ae') {
      await page.waitForSelector('#GLUXCityList')
      while (true) {
        try {
          await page.$eval('#GLUXCityList_0', optionEl => optionEl.click())
          break
        } catch (e) {
          await page.$eval('#GLUXCityList', selectEl => selectEl.click())
        }
      }
    } else {
      await page.waitForSelector('.GLUX_Inline [aria-labelledby="GLUXZipUpdate-announce"]')
      await page.evaluate((locationForm, zipCode) => {
        locationForm.querySelector('#GLUXZipUpdateInput').value = zipCode
      }, await page.$('#GLOWFeature_AddressList'), zipCode)
      while (true) {
        try {
          await page.$eval('#GLUXZipInputSection:not([style*="display: none;"]) [aria-labelledby="GLUXZipUpdate-announce"]', applyButton => {
            applyButton.click()
          })
          await new Promise(resolve => setTimeout(resolve, 25))
        } catch (e) {
          break
        }
      }
      while (true) {
        try {
          if (domainExtension === 'de') {
            await page.$eval('.a-popover-footer button', continueButton => {
              continueButton.click()
            })
          } else {
            await page.$$eval('#GLUXConfirmClose', continueButtons => {
              continueButtons[1].click()
            })
          }
          await new Promise(resolve => setTimeout(resolve, 25))
        } catch (e) {
          break
        }
      }
      await page.waitForFunction('!document.querySelector(\'#glow-ingress-line2\')')
      await page.waitForFunction('document.querySelector(\'.a-spacing-top-small a\') !== null')
    }
  }
}

const searchProductsByKeywords = async (browser, keywords, maxResultsPerKeyword, domainExtension) => {
  const page = await browser.newPage()
  const productUrls = []
  if (!getZipCodeFromExtension(domainExtension)) {
    console.log(`The site "amazon.${domainExtension}" is not supported by this tool.`)
    console.log('Automated scraping is only available for the following Amazon sites:')
    console.log('"amazon.com", "amazon.co.uk", "amazon.ca", "amazon.in", "amazon.sg" and "amazon.ae"')
    process.exit(0)
  }
  let isInitialized = false
  for (const keyword of keywords) {
    const searchUrl = 'https://www.amazon.' + domainExtension + '/s?k=' + keyword.replace(' ', '+')// + '&bbn=16225005011&rh=n%3A%2116225005011%2Cn%3A166777011'; // Search only in "Baby > Feeding"
    await page.goto(searchUrl)
    await page.waitForSelector('body')
    if (!isInitialized) {
      await initialSetup(page)
      isInitialized = true
    }
    if ((await page.$('span[class*="no-results"]')) !== null) {
      // No results for this keyword, skip to the next
      productUrls.push([])
      continue
    }
    const keywordUrls = []
    while (true) {
      await page.waitForSelector('[data-component-type="s-search-results"] [data-asin]:not(.AdHolder)')
      const productsInPage = await page.$$eval('[data-component-type="s-search-results"] [data-asin]:not(.AdHolder)', (products) => {
        return products
          .filter(el => (
            // Filter "Sponsored" search results and recommendations
            el.querySelector('[data-component-type="sp-sponsored-result"]') === null &&
            el.attributes['data-asin'] &&
            el.attributes['data-asin'].value !== '' &&
            // Filter videos and books
            el.querySelector('[class="a-size-base a-link-normal a-text-bold"]') === null &&
            el.querySelector('.a-spacing-top-small a') !== null &&
            el.querySelector('.a-spacing-top-small a').href.match('/gp/') === null
          ))
          // Extract product URLs from links
          .map(el => el.querySelector('.a-spacing-top-small a').href.replace(/(?<=\/)ref.*$/, ''))
      })
      if (keywordUrls.length + productsInPage.length > maxResultsPerKeyword) {
        keywordUrls.push(...productsInPage.slice(0, maxResultsPerKeyword - keywordUrls.length))
        break
      } else if ((await page.$('.a-disabled.a-last')) !== null) {
        // No more results
        keywordUrls.push(...productsInPage)
        break
      }
      keywordUrls.push(...productsInPage)
      // Move to next page
      try{
        await page.waitForSelector('.a-last a', {timeout:5000})
      } catch(e){
        console.log('timeout waiting for last link');
        console.log(keywordUrls.length);
      }
      await page.$eval('.a-last a', nextButton => nextButton.click())
      await page.waitForFunction('document.querySelector(\'[data-component-type="s-search-results"] [data-asin]:not(.AdHolder)\') === null')
    }
    productUrls.push(keywordUrls)
  }
  // Return all the urls of the products to scrape, grouped by origin keyword
  return productUrls
}

const getDetails = async (page) => {
  await page.waitForSelector('#main-image-container .image.selected img')
  // Check for multiple variants, if so, choose first one
  if ((await page.$('.imageSwatches')) !== null) {
    await page.$eval('.imageSwatches img', img => img.click())
  }
  const result = await page.$eval('body', (body) => {
    const url = document.location.href
    const asin = url.match(/([A-Z0-9]{10})/)[0]
    const upcMatch = body.innerText.match(/(?<=UPC).*[0-9]*/)
    const upc = upcMatch !== null ? upcMatch[0].replace(/[^0-9]/g, '') : null
    const sourceUrl = url.split(/(?<=[A-Za-z0-9])\/(?=[A-Za-z0-9])/)[0].split('//')[1].replace(/^(www\.)/, '')
    // eslint-disable-next-line
    const priceStr = body.querySelector('span[class*="price"]').innerText.replace(/(^ | $)| /g, '').split('-')[0]
    return {
      asin,
      upc,
      source: sourceUrl,
      name: body.querySelector('#productTitle').innerText,
      // eslint-disable-next-line
      description: body.querySelector('#feature-bullets>ul') ? body.querySelector('#feature-bullets>ul').outerHTML.replace(/( class=".*"|	|\n)/g, '') : '',
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
  const result = await page.$$eval('div[id$="product-description_feature_div"]', possibleDescriptionsEls => {
    const possibleDescriptions = Array.from(possibleDescriptionsEls)
    const areDescriptionsEmpty = possibleDescriptions.map(el => el.innerHTML.replace(/(\n| )/g, '').length !== 0)
    let descriptionDetailIndex = -1
    areDescriptionsEmpty.some((description, i) => {
      if (description) {
        descriptionDetailIndex = i
        return true
      }
      return false
    })
    let descriptionDetail = null
    if (descriptionDetailIndex !== -1) {
      descriptionDetail = possibleDescriptions[descriptionDetailIndex].outerHTML
        .replace(/[ \n]{2,}/gs, '')
    }
    return descriptionDetail
  })
  return result
}

const getPhotos = async (page) => {
  await page.waitForSelector('#altImages .imageThumbnail input')
  // First, click on the main image to open the image viewer popup
  const photoUrls = await page.$$eval('#altImages .imageThumbnail input', thumbnailPhotos => {
    return thumbnailPhotos.map(thumbnail => {
      thumbnail.click()
      return document.querySelector('#main-image-container .image.selected img').src
    })
  })
  const photos = await Promise.all(photoUrls.map(url => {
    return getPhotoAsBuffer(url).then(buffer => {
      return {
        url,
        data: buffer
      }
    })
  }))
  return photos
}

const getReviews = async (browser, page) => {
  const url = page.url()
  const asin = url.match(/([A-Z0-9]{10})/)[0]
  const baseUrl = url.split(/(?<=[A-Za-z0-9])\/(?=[A-Za-z0-9])/)[0]
  await page.waitForSelector('#main-image-container .image.selected img')
  // No reviews
  if ((await page.$('[data-hook^="reviews-medley"] [id*="footer"] a')) === null) {
    return {
      reviews: [],
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
  const goToAmazonDotCom = await page.$eval('[data-hook^="reviews-medley"] [id*="footer"] a', el => el.innerText.split('\n')[0].match('Amazon.com') !== null)
  const correctedBaseUrl = goToAmazonDotCom ? baseUrl.replace('https://www.amazon.' + baseUrl.replace('https://www.amazon.', '').split('/')[0], 'https://www.amazon.com') : baseUrl
  const reviewsBaseUrl = correctedBaseUrl + `/product-reviews/${asin}/`
  const filteredReviews = []
  const tempPage = await browser.newPage()
  let ratingResult
  let currentPage = 0
  while (true) {
    const reviewPageUrl = reviewsBaseUrl + `?pageNumber=${currentPage + 1}`
    console.log('Processing: ' + reviewPageUrl)
    await tempPage.goto(reviewPageUrl)
    await tempPage.waitForSelector('body')

    if (currentPage === 0) {
      await tempPage.waitForSelector('#histogramTable .a-histogram-row', { timeout: 5000 })
      const overallRating = await tempPage.$eval('[data-hook="rating-out-of-text"]', ratingSpan => Number(ratingSpan.innerText.split(' ')[0].replace(',', '')))
      const totalRatings = await tempPage.$eval('[data-hook="total-review-count"] span', ratingSpan => Number(ratingSpan.innerText.split(' ')[0].replace(',', '')))
      const percentages = (
        await tempPage.$$eval(
          '#histogramTable .a-histogram-row',
          ratingsAsPercentages => ratingsAsPercentages.map(percentage => {
            let rating = 0
            if (percentage.attributes['data-reviews-state-param']) {
              rating = Number(percentage.querySelector('.a-text-right a').innerText.replace('%', '')) / 100
            }
            if (isNaN(rating)) {
              rating = 0
            }
            return rating
          })
        )
      )
      ratingResult = {
        overall: overallRating,
        total: totalRatings,
        fiveStars: Math.trunc(totalRatings * percentages[0]),
        fourStars: Math.trunc(totalRatings * percentages[1]),
        threeStars: Math.trunc(totalRatings * percentages[2]),
        twoStars: Math.trunc(totalRatings * percentages[3]),
        oneStars: Math.trunc(totalRatings * percentages[4])
      }
    }
    const pageReviews = await tempPage.$$eval('.a-section.review', reviews => {
      return reviews.map(reviewEl => {
        const foundHelpful = Number(
          reviewEl.querySelector('.cr-vote-text')
            ? reviewEl.querySelector('.cr-vote-text').innerText.split(' ')[0]
            : 0
        )
        const review = {
          name: reviewEl.querySelector('.a-profile-name').innerText,
          rating: Number(
            reviewEl.querySelector('i[class*="a-star"').innerText.slice(0, 1)
          ),
          title: reviewEl.querySelector('.review-title>span').innerText,
          date: reviewEl.querySelector('.review-date').innerText,
          isVerifiedPurchase: !!reviewEl.querySelector('span[data-hook="avp-badge"]'),
          textContent: reviewEl.querySelector('.review-text-content>span').innerText,
          foundHelpful: foundHelpful || 0
        }
        return review
      })
    })
    filteredReviews.push(...pageReviews)
    const reviewArray = await tempPage.$eval('[data-hook="cr-filter-info-review-count"]', reviewIndi => reviewIndi.innerText.split(' '))
    const totalCount = reviewArray[3]
    const currentCount = reviewArray[1].split('-')[1];
    if (totalCount === currentCount) {
      break
    }
    currentPage++
  }
  await tempPage.close()
  return {
    reviews: filteredReviews,
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
