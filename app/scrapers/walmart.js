const BaseScraper = require('./baseScraper');
const logger = require('winston');
const _ = require('lodash');
const config = require('../../config');
const helpers = require('../utils/helpers');

class WalmartScraper extends BaseScraper {

    constructor(scraperConfig, websiteConfig) {
        super(scraperConfig, websiteConfig);
    }

    // Check if there's a next results page
    async hasMoreSearchResults(searchResultsPage) {
        await searchResultsPage.waitForSelector('.paginator-list');
        const paginationElement = await searchResultsPage.$('.paginator-list');
        if (!paginationElement) {
            return false;
        }
        const nextLi = await searchResultsPage.$('.paginator-list li.active + li');
        if (!nextLi) {
            return false;
        }
        await nextLi.click();
        await searchResultsPage.waitForSelector('#searchProductResult');
        return true;
    }

    filterUrls(urls) {
        return super.filterUrls(urls);
    }

    // Get paginated reviews
    async getProductReviews(ratingsPage, selector) {
        try {
            let reviews = [];
            // eslint-disable-next-line no-constant-condition
            while(true) {
                const reviewElements = await ratingsPage.$$(selector);
                const reviewTextElements = await Promise.all(_.map(reviewElements, async reviewElement => await reviewElement.getProperty('innerText')));
                reviews = reviews.concat(await Promise.all(_.map(reviewTextElements, async reviewTextElement => await reviewTextElement.jsonValue())));
                const hasNext = await ratingsPage.evaluate(() => {
                    // eslint-disable-next-line no-undef
                    const nextPageButton = document.querySelector('ul.paginator-list li.active + li button');
                    if (nextPageButton) {
                        nextPageButton.click();
                        return true;
                    }
                    return false;
                });
                // Wait until the reviews are loaded on the page
                await ratingsPage.waitFor(500);
                if (!hasNext) {
                    break;
                }
            }
            return reviews;
        } catch (error) {
            logger.error(`An error occurred while retrieving product reviews`);
            logger.error(error.message);
        }
        return [];
    }

    async getProductRatingInfo(ratingsPage) {
        return {
            ratingInfo: {
                overallRating: await this.getNumberElement(ratingsPage, this.scraperConfig.PRODUCT_INFO_SELECTORS.RATING_OVERALL),
                totalNumberOf5StarRatings: await this.getNumberElement(ratingsPage, this.scraperConfig.PRODUCT_INFO_SELECTORS.RATING_5_STARS),
                totalNumberOf4StarRatings: await this.getNumberElement(ratingsPage, this.scraperConfig.PRODUCT_INFO_SELECTORS.RATING_4_STARS),
                totalNumberOf3StarRatings: await this.getNumberElement(ratingsPage, this.scraperConfig.PRODUCT_INFO_SELECTORS.RATING_3_STARS),
                totalNumberOf2StarRatings: await this.getNumberElement(ratingsPage, this.scraperConfig.PRODUCT_INFO_SELECTORS.RATING_2_STARS),
                totalNumberOf1StarRatings: await this.getNumberElement(ratingsPage, this.scraperConfig.PRODUCT_INFO_SELECTORS.RATING_1_STARS)
            },
            userReviews: await this.getProductReviews(ratingsPage, this.scraperConfig.PRODUCT_INFO_SELECTORS.USER_REVIEW)
        };
    }

    prepareImageUrls(imageUrls) {
        // remove width and height limits to get the full size image
        return _.map(imageUrls, imageUrl => helpers.removeUrlParams(imageUrl, ['odnWidth', 'odnHeight']));
    }

    
    async getUPC(productPage) {
        return await productPage.evaluate(() => {
            // eslint-disable-next-line no-undef
            const itemJSONElement = document.getElementById('item');
            if (!itemJSONElement || !itemJSONElement.innerHTML) {
                return null;
            }
            const itemJSON = JSON.parse(itemJSONElement.innerHTML);
            if (!itemJSON.product || !itemJSON.product.buyBox || !itemJSON.product.buyBox.products || !itemJSON.product.buyBox.products.length) {
                return null;
            }
            return itemJSON.product.buyBox.products[0].upc;
        })
    }

    async prepareProductPage(url, browser) {
        const productPage = await browser.newPage();
        await productPage.goto(url, {
            timeout: config.PAGE_NAVIGATION_TIMEOUT
        });
        await productPage.waitFor(2000);
        //await productPage.waitForSelector('.prod-alt-image-wrapper');
        return productPage;
    }

    async prepareRatingsPage(productId, browser) {
        const ratingsPage = await browser.newPage();
        logger.debug(`Navigating to reviews page ${this.websiteConfig.URL}/reviews/product/${productId}`);
        await ratingsPage.goto(`${this.websiteConfig.URL}/reviews/product/${productId}`, {
            timeout: config.PAGE_NAVIGATION_TIMEOUT
        });
        await ratingsPage.waitForSelector('body');
        return ratingsPage;
    }

    async getProductId(url) {
        return url.match(/\/(ip|co|nco)\/.*\/([0-9]+)/)[2];
    }
    
    async filterPredicateBasedOnElementProperty(element, property, value) {
        return (await (await element.getProperty(property)).jsonValue()).toLowerCase().trim() === value;
    }

    async getCategoryButton(searchResultsPage, category) {
        try {
            const categoryElements = await searchResultsPage.$$('#SearchDropdown-list button span span');
            if (categoryElements) {
    
                const filterPredicateResults = await Promise.all(_.map(categoryElements, categoryElement => this.filterPredicateBasedOnElementProperty(categoryElement, 'innerText', category)));
    
                const categoryElement = _.chain(categoryElements)
                .zip(filterPredicateResults) // match the predicate results to the category elements
                .filter(1) // filter based on the predicate results
                .map(0) // map to just the row values
                .value()[0]; // get the result of the chain (filtered array of rows)

                return (await categoryElement.$x('./ancestor::button'))[0];
            }
        } catch (error) {
            logger.error(`An error occurred while retrieving the category button on ${this.websiteConfig.URL}`);
            logger.error(error.message);
        }
        return null;
    }

    async navigateOnSearchResultsPage(keyword, category, searchResultsPage) {
        await searchResultsPage.type('#global-search-input', keyword);
        if (category) {
            await searchResultsPage.click('#global-search-dropdown-toggle');
            const categoryButton = await this.getCategoryButton(searchResultsPage, category);
            await categoryButton.click();
        }
        await searchResultsPage.click('#global-search-submit');
        await searchResultsPage.waitForSelector('#searchProductResult');
    }
}

module.exports = WalmartScraper;