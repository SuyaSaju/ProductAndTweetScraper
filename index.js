const puppeteer = require('puppeteer');
const config = require('./config');
const logger = require('./app/utils/logger');
// Setup db connection
require('./app/utils/db');

puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] }).then(async browser => {
    for (const key in config.WEBSITES_TO_SCRAPE) {
        const websiteConfig = config.WEBSITES_TO_SCRAPE[key];
        const ScraperClass = require('./app/scrapers/' + websiteConfig.SCRAPER.toLowerCase());
        const scraper = new ScraperClass(config.SCRAPERS_CONFIG[websiteConfig.SCRAPER], websiteConfig);
        await scraper.scrape(browser);
    }
    logger.debug('Product scraping finished successfully');
    return await browser.close();
}).catch(error => {
    logger.error('An error occurred while scraping products');
    logger.error(error.message);
});