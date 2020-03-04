/* eslint-disable no-undef */
const BaseScraper = require('./baseScraper');
const logger = require('winston');
const _ = require('lodash');
const config = require('../../config');

class FirstCryScraper extends BaseScraper {

    constructor(scraperConfig, websiteConfig) {
        super(scraperConfig, websiteConfig);
        this.idxOfLastProcessedProduct = 0;
    }

    // Check if more results are loaded via scrolling to the bottom of the page
    async hasMoreSearchResults(searchResultsPage) {
        const numberOfLoadedSearchResults = (await searchResultsPage.$$('#maindiv .list_block')).length;
        await searchResultsPage.evaluate(()=> {    
            window.scrollTo(0,document.body.scrollHeight);
        });
        const nrOfLoadedResults = (await searchResultsPage.$$('#maindiv .list_block')).length - numberOfLoadedSearchResults;
        logger.debug(`Loaded ${nrOfLoadedResults} more results`)

        return nrOfLoadedResults > 0;
    }

    filterUrls(urls) {
        const filteredUrls = super.filterUrls(urls);
        return _.uniq(_.filter(filteredUrls, url => !(/combopack/.test(url)) && /\/([0-9]+)(\/product-detail)/.test(url)), url => url.match(/\/([0-9]+)(\/product-detail)/)[1]);
    }

    async getProductReviews(ratingsPage, selector) {
        try {
            const reviewElements = await ratingsPage.$$(selector);
            const reviewTextElements = await Promise.all(_.map(reviewElements, async reviewElement => await reviewElement.getProperty('innerText')));
            const reviews = await Promise.all(_.map(reviewTextElements, async reviewTextElement => await reviewTextElement.jsonValue()));
            return reviews;
        } catch (error) {
            logger.error(`An error occurred while retrieving product reviews`);
            logger.error(error.message);
            return [];
        }
    }
    
    async getRatingElement(ratingsPage, selector) {
        const numberOfStarRatingsText = await this.getElementTitleByTryingSelectors(ratingsPage, selector);
        return numberOfStarRatingsText ? Number(numberOfStarRatingsText) : 0;
    }

    async getProductRatingInfo(ratingsPage) {
        return {
            ratingInfo: {
                overallRating: await this.getNumberElement(ratingsPage, this.scraperConfig.PRODUCT_INFO_SELECTORS.RATING_OVERALL),
                totalNumberOf5StarRatings: await this.getRatingElement(ratingsPage, this.scraperConfig.PRODUCT_INFO_SELECTORS.RATING_5_STARS),
                totalNumberOf4StarRatings: await this.getRatingElement(ratingsPage, this.scraperConfig.PRODUCT_INFO_SELECTORS.RATING_4_STARS),
                totalNumberOf3StarRatings: await this.getRatingElement(ratingsPage, this.scraperConfig.PRODUCT_INFO_SELECTORS.RATING_3_STARS),
                totalNumberOf2StarRatings: await this.getRatingElement(ratingsPage, this.scraperConfig.PRODUCT_INFO_SELECTORS.RATING_2_STARS),
                totalNumberOf1StarRatings: await this.getRatingElement(ratingsPage, this.scraperConfig.PRODUCT_INFO_SELECTORS.RATING_1_STARS)
            },
            userReviews: await this.getProductReviews(ratingsPage, this.scraperConfig.PRODUCT_INFO_SELECTORS.USER_REVIEW)
        };
    }

    prepareImageUrls(imageUrls) {
        // remove width and height limits to get the full size image
        return _.map(imageUrls, imageUrl => imageUrl.replace(/(?<left>.*products\/)(.*x.*)(?<right>\/.*)/, '$<left>438x531$<right>'));
    }

    async getUPC(productPage) {
        const upc = await productPage.evaluate(() => {
            // eslint-disable-next-line no-undef
            const upcLabel = Array.from(document.querySelectorAll('#div_prod_desc b')).find(el => el.textContent === 'GTIN/Barcode:');
            if (!upcLabel) {
                return null;
            }
            return upcLabel.nextSibling.textContent.trim();
        });
        return upc;
    }

    async prepareProductPage(url, browser) {
        const productPage = await browser.newPage();
        await productPage.goto(url, {
            timeout: config.PAGE_NAVIGATION_TIMEOUT
        });
        await productPage.waitForSelector('#div_prod_desc');
        return productPage;
    }

    async prepareRatingsPage(productId, browser) {
        const ratingsPage = await browser.newPage();
        const ratingsPageUrl = `${this.websiteConfig.URL}/pdp-review?pid=${productId}`;
        logger.info(`Navigating to ratings page ${ratingsPageUrl}`);
        await ratingsPage.goto(ratingsPageUrl, {
            timeout: config.PAGE_NAVIGATION_TIMEOUT
        });
        await ratingsPage.waitForSelector('body');
        let loadedReviews = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
            // Click "Load more" link util all reviews are shown
            await ratingsPage.evaluate(() => {
                ReadAllReview();
            });
            await ratingsPage.waitFor(2000);
            const reviews = await this.getProductReviews(ratingsPage, this.scraperConfig.PRODUCT_INFO_SELECTORS.USER_REVIEW);
            if (reviews.length === loadedReviews) {
                break;
            }
            loadedReviews = reviews.length;
        }
        return ratingsPage;
    }

    async getProductId(url) {
        return url.match(/\/([0-9]+)(\/product-detail)/)[1];
    }
    
    async navigateOnSearchResultsPage(keyword, category, searchResultsPage) {
        await searchResultsPage.click('#search_box');
        await searchResultsPage.type('#search_box', keyword);
        await searchResultsPage.click('.search-button');
        await searchResultsPage.waitFor(3000);
    }
}

module.exports = FirstCryScraper;