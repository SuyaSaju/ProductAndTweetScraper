const BaseScraper = require('./baseScraper');
const logger = require('winston');
const _ = require('lodash');
const config = require('../../config');

class AmazonScraper extends BaseScraper {

    constructor(scraperConfig, websiteConfig) {
        super(scraperConfig, websiteConfig);
    }

    // Check if there's a next results page
    async hasMoreSearchResults(searchResultsPage) {
        await searchResultsPage.waitForSelector('.a-pagination');
        const paginationElement = await searchResultsPage.$('.a-pagination');
        if (!paginationElement) {
            return false;
        }
        const nextLi = await searchResultsPage.$('.a-pagination li.a-selected + li:not(.a-last)');
        if (!nextLi) {
            return false;
        }
        await nextLi.click();
        await searchResultsPage.waitFor(2000);
        await searchResultsPage.waitForSelector('body');
        return true;
    }

    filterUrls(urls) {
        const filteredUrls = super.filterUrls(urls);
        // ignore urls with redirection and with duplicated product ids
        return _.uniq(_.filter(filteredUrls, url => !(/slredirect/.test(url)) && /(?:[/dp/]|$)([A-Z0-9]{10})/.test(url)), url => url.match(/(?:[/dp/]|$)([A-Z0-9]{10})/)[1]);
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
                    const nextPageButton = document.querySelector('#cm_cr-pagination_bar .a-pagination .a-last:not(.a-disabled) a');
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
    
    async getNumberOfStartRatings(ratingsPage, totalNrOfReviews, selector) {
        const numberOfStarRatingsText = await this.getElementTextByTryingSelectors(ratingsPage, selector);
        return Math.floor(totalNrOfReviews * (numberOfStarRatingsText ? Number(numberOfStarRatingsText.match(/(\d+)%/)[1]) : 0) / 100);
    }

    async getProductRatingInfo(ratingsPage) {

        const overallRatingText = await this.getElementTextByTryingSelectors(ratingsPage, this.scraperConfig.PRODUCT_INFO_SELECTORS.RATING_OVERALL);
        const overallRating = overallRatingText ? Number(overallRatingText.match(/(.*) out of 5/)[1]) : null;

        const totalNrOfReviewsElement = await this.getElementTextByTryingSelectors(ratingsPage, ['.averageStarRatingNumerical span']);
        const totalNrOfReviews = totalNrOfReviewsElement ? Number(totalNrOfReviewsElement.match(/(.*) customer rating/)[1].replace(',', '')) : 0;

        return {
            ratingInfo: {
                overallRating,
                totalNumberOf5StarRatings: await this.getNumberOfStartRatings(ratingsPage, totalNrOfReviews, this.scraperConfig.PRODUCT_INFO_SELECTORS.RATING_5_STARS),
                totalNumberOf4StarRatings: await this.getNumberOfStartRatings(ratingsPage, totalNrOfReviews, this.scraperConfig.PRODUCT_INFO_SELECTORS.RATING_4_STARS),
                totalNumberOf3StarRatings: await this.getNumberOfStartRatings(ratingsPage, totalNrOfReviews, this.scraperConfig.PRODUCT_INFO_SELECTORS.RATING_3_STARS),
                totalNumberOf2StarRatings: await this.getNumberOfStartRatings(ratingsPage, totalNrOfReviews, this.scraperConfig.PRODUCT_INFO_SELECTORS.RATING_2_STARS),
                totalNumberOf1StarRatings: await this.getNumberOfStartRatings(ratingsPage, totalNrOfReviews, this.scraperConfig.PRODUCT_INFO_SELECTORS.RATING_1_STARS)
            },
            userReviews: await this.getProductReviews(ratingsPage, this.scraperConfig.PRODUCT_INFO_SELECTORS.USER_REVIEW)
        };
    }

    async getUPC(productPage) {
        return await productPage.evaluate(() => {
            // eslint-disable-next-line no-undef
            const upcLabel = Array.from(document.querySelectorAll('td.label')).find(el => el.textContent === 'UPC');
            if (!upcLabel || !upcLabel.parentElement) {
                return null;
            }
            const upcValue = upcLabel.parentElement.querySelector('td.value');
            if (!upcValue) {
                return null;
            }
            return upcValue.innerText;
        })
    }

    async prepareProductPage(url, browser) {
        const productPage = await browser.newPage();
        await productPage.goto(url, {
            timeout: config.PAGE_NAVIGATION_TIMEOUT
        });
        // click image thumbnails to load all the product images
        const imageThumbnails = await productPage.$$('.imageThumbnail');
        await Promise.all(_.map(imageThumbnails, imageThumbnail => imageThumbnail.click()));
        await productPage.waitForSelector('body');
        // See more details to show the UPC code
        const seeMoreDetailsLink = await productPage.$('#seeMoreDetailsLink');
        if (seeMoreDetailsLink) {
            seeMoreDetailsLink.click();
        }
        await productPage.waitFor(1000);
        return productPage;
    }

    async prepareRatingsPage(productId, browser) {
        const ratingsPage = await browser.newPage();
        await ratingsPage.goto(`${this.websiteConfig.URL}/product-reviews/${productId}`, {
            timeout: config.PAGE_NAVIGATION_TIMEOUT
        });
        await ratingsPage.waitForSelector('body');
        return ratingsPage;
    }

    async getProductId(url) {
        return url.match(/(?:[/dp/]|$)([A-Z0-9]{10})/)[1];
    }
    
    async navigateOnSearchResultsPage(keyword, category, searchResultsPage) {
        await searchResultsPage.type('#twotabsearchtextbox', keyword);
        if (category) {
            await searchResultsPage.type('select#searchDropdownBox', category);
        }
        await searchResultsPage.waitFor(2000);
        await searchResultsPage.click('input.nav-input');
        await searchResultsPage.waitFor(2000);
    }
}

module.exports = AmazonScraper;