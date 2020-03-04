const _ = require('lodash');
const logger = require('winston');
const config = require('../../config');
const ProductModel = require('../models/product');
const helpers = require('../utils/helpers');

class BaseScraper {

    constructor(scraperConfig, websiteConfig) {
        this.scraperConfig = scraperConfig;
        this.websiteConfig = websiteConfig;
        this.productUrls = {};
    }

    filterUrls(urls) {
        return urls;
    }

    // Trying different selectors, return the property of the first found element
    async getElementPropertyByTryingSelectors(productPage, possibleSelectors, property) {
        try {
            let selectorIdx = 0;
            while (selectorIdx < possibleSelectors.length) {
                const element = await productPage.$(possibleSelectors[selectorIdx]);
                if (element) {
                    const elementInnerTextObj = await element.getProperty(property);
                    if (elementInnerTextObj) {
                        return await elementInnerTextObj.jsonValue();
                    }
                }
                selectorIdx++;
            }
            return null;
        } catch (error) {
            logger.error(`An error occurred while retrieving element text for selectors ${possibleSelectors}`);
            logger.error(error.message);
        }
        return null;
    }

    async getElementTextByTryingSelectors(productPage, possibleSelectors) {
        return await this.getElementPropertyByTryingSelectors(productPage, possibleSelectors, 'innerText');
    }

    async getElementHTMLByTryingSelectors(productPage, possibleSelectors) {
        return await this.getElementPropertyByTryingSelectors(productPage, possibleSelectors, 'innerHTML');
    }
    async getElementTitleByTryingSelectors(productPage, possibleSelectors) {
        return await this.getElementPropertyByTryingSelectors(productPage, possibleSelectors, 'title');
    }

    async getNumberElement(page, selector) {
        const numberText = await this.getElementTextByTryingSelectors(page, selector);
        return numberText ? Number(numberText) : 0;
    }

    async getProductImageUrls(productPage, imageSelector) {
        try {
            const imageElements = await productPage.$$(imageSelector);
            const imageUrlsElements = await Promise.all(_.map(imageElements, async imageElement => await imageElement.getProperty('src')));
            const imageUrls = await Promise.all(_.map(imageUrlsElements, async imageElement => await imageElement.jsonValue()));
            return imageUrls;
        } catch (error) {
            logger.error(`An error occurred while retrieving product image urls`);
            logger.error(error.message);
        }
        return [];
    }

    async saveProduct(productData) {
        try {
            // save or replace
            const saveResult = await ProductModel.findOneAndUpdate({id: productData.id}, productData, {upsert: true});
            if (saveResult !== null) {
                logger.info(`Product with id ${productData.id} was updated in db`);
            } else {
                logger.info(`Product with id ${productData.id} was added in db`);
            }
        } catch (error) {
            logger.error(`An error occurred while saving product with id ${productData.id}`);
            logger.error(error.message);
        }
    }

    async getProductBasicInfo(productPage) {
        return {
            upc: await this.getUPC(productPage),
            name: await this.getElementTextByTryingSelectors(productPage, this.scraperConfig.PRODUCT_INFO_SELECTORS.NAME),
            price: await this.getElementTextByTryingSelectors(productPage, this.scraperConfig.PRODUCT_INFO_SELECTORS.PRICE),
            description: await this.getElementTextByTryingSelectors(productPage, this.scraperConfig.PRODUCT_INFO_SELECTORS.DESCRIPTION),
            descriptionDetail: await this.getElementHTMLByTryingSelectors(productPage, this.scraperConfig.PRODUCT_INFO_SELECTORS.DESCRIPTION_DETAIL),
            images: await Promise.all(_.map(this.prepareImageUrls(await this.getProductImageUrls(productPage, this.scraperConfig.PRODUCT_INFO_SELECTORS.IMAGE)), helpers.loadImage))
        };
    }

    async getProductUrlsFromCurrentPage(searchResultsPage, productSelector) {
        try {
            const products = await searchResultsPage.$$(productSelector);
            return await Promise.all( _.map(products, async product => await searchResultsPage.evaluate(el => el.href, product)));
        } catch (error) {
            logger.error(`An error occurred while getting the products urls for`);
            logger.error(error.message);
        }
        return [];
    }

    async populateProductUrls(keyword, searchResultsPage) {
        try {
            if (this.productUrls[keyword].length < this.websiteConfig.MAX_NUMBER_OF_PRODUCTS_PER_KEYWORD) {
                const urls = this.filterUrls(await this.getProductUrlsFromCurrentPage(searchResultsPage, this.scraperConfig.PRODUCT_SELECTOR));
                const urlsToProcess = urls.slice(0, Math.min(this.websiteConfig.MAX_NUMBER_OF_PRODUCTS_PER_KEYWORD - this.productUrls[keyword].length, urls.length));
                this.productUrls[keyword] = _.concat(this.productUrls[keyword], urlsToProcess);
                if (this.productUrls[keyword].length < this.websiteConfig.MAX_NUMBER_OF_PRODUCTS_PER_KEYWORD) {
                    // go to next page if there's a next page
                    const hasMoreSearchResults = await this.loadMoreSearchResults(keyword, searchResultsPage);
                    if (hasMoreSearchResults) {
                        await this.populateProductUrls(keyword, searchResultsPage);
                    }
                }
            }
        } catch (error) {
            logger.error(`An error occurred while populating the products urls for keyword ${keyword} on ${this.websiteConfig.URL}`);
            logger.error(error.message);
        }
    }

    async loadMoreSearchResults(keyword, searchResultsPage) {
        try {
            logger.debug(`Trying to load more search results for keyword ${keyword} on ${this.websiteConfig.URL}`);
            const hasMoreSearchResults = await this.hasMoreSearchResults(searchResultsPage);
            if (!hasMoreSearchResults) {
                logger.info(`No more results found for keyword ${keyword} on ${this.websiteConfig.URL}`);
            }
            return hasMoreSearchResults;
        } catch (error) {
            logger.error(`An error occurred while navigating to search results next page for keyword ${keyword} on ${this.websiteConfig.URL}`);
            logger.error(error.message);
        }
        return false;
    }

    async searchProducts(keyword, category, browser) {
        try {
            this.productUrls[keyword] = [];
            logger.debug(`Searching products with keyword ${keyword} on ${this.websiteConfig.URL}`);
            const searchResultsPage = await browser.newPage();
            await searchResultsPage.goto(this.websiteConfig.URL, {
                timeout: config.PAGE_NAVIGATION_TIMEOUT
            });
            await this.navigateOnSearchResultsPage(keyword, category, searchResultsPage);
            const hasSearchResults = await this.areSearchResultsLoaded(searchResultsPage, this.scraperConfig.SEARCH_RESULTS_SELECTOR, keyword);
            if (hasSearchResults) {
                await this.populateProductUrls(keyword, searchResultsPage);
            }
            await searchResultsPage.close();
        } catch (error) {
            logger.error(`An error occurred while searching for products with keyword ${keyword} on ${this.websiteConfig.URL}`);
            logger.error(error.message);
        }
    }

    async areSearchResultsLoaded(searchResultsPage, searchResultsSelector, keyword) {
        const searchResults = await searchResultsPage.$(searchResultsSelector);
        if (!searchResults) {
            logger.info(`Search results for ${keyword} on ${this.websiteConfig.URL} couldn't be loaded`);
            return false;
        } else {
            logger.debug(`Search results for ${keyword} on ${this.websiteConfig.URL} successfully loaded`);
            return true;
        }
    }

    // Default filter. Overridden in subclasses
    prepareImageUrls(imageUrls) {
        return imageUrls;
    }

    async processProduct(url, keyword, browser) {
        try {
            logger.debug(`Processing product at url ${url}`);

            // Get basic product data and then close the product details page
            const productId = await this.getProductId(url);
            const productPage = await this.prepareProductPage(url, browser);
            const productInfo = await this.getProductBasicInfo(productPage);
            logger.info(`Loaded ${productInfo.images.length} images`);
            await productPage.close();
            
            // Get product ratings/reviews and then close the ratings page
            const ratingsPage = await this.prepareRatingsPage(productId, browser);
            const productReviews = await this.getProductRatingInfo(ratingsPage);
            logger.info(`Loaded ${productReviews.userReviews.length} user reviews`);
            await ratingsPage.close();

            // Compose the product data for save
            const productDataForSave = _.extend(_.extend({
                id: productId,
                source: this.websiteConfig.URL,
                url,
                keyword,
            }, productInfo), productReviews);
            await this.saveProduct(productDataForSave);
        } catch (error) {
            logger.error(`An error occurred while processing product from url ${url}`);
            logger.error(error.message);
        }
    }
    
    async scrape(browser) {
        try {
            // populate product urls first and close search pages before processing each product
            for (const key in this.websiteConfig.KEYWORDS) {
                const keyword = this.websiteConfig.KEYWORDS[key].NAME;
                const category = this.websiteConfig.KEYWORDS[key].CATEGORY;
                await this.searchProducts(keyword, category, browser);
            }
            for (const key in this.websiteConfig.KEYWORDS) {
                const keyword = this.websiteConfig.KEYWORDS[key].NAME;
                for (const key in this.productUrls[keyword]) {
                    const url = this.productUrls[keyword][key];
                    await this.processProduct(url, keyword, browser);
                }
            }
        } catch (error) {
            logger.error(`An error occurred while scraping products on ${this.websiteConfig.URL}`);
            logger.error(error.message);
        }
    }
}

module.exports = BaseScraper;