# Infant Nutrition - Product Scraper Tool
Deployment Guide

### Description

Scrape products and their photos and reviews from Amazon (.com, .co.uk, .ca, .in, .sg and .ae), Walmart and FirstCry, and store the results in a MongoDB database.
For the scraped products, fetch their corresponding tweets based on generated keywords and save it in mongo db.

## Prerequisites
1. Node 13.x
2. Docker & Docker-Compose

## Configuration

The configuration, such as sites to scrape and keywords, is provided to the tool via JSON configuration files, located in `./config`.

It's important to note that each version of Amazon counts as a different site, and the provided keywords are scraped independently for each site. Take that into account when choosing the products to scrape for each keyword. For more information on the workflow of the tool, check the `Workflow` section under `Notes`.

Twitter related configurations such as maximum number of tweets to fetch per keyword are stored in [twitter-config.json](config/twitter-config.json)

### Available Options

A configuration file must be named `configX.json`, where `X` is a number. E.g. `config3.json`

The options that you can define are:
- `verificationApi`: A boolean value that indicates whether to expose an API endpoint that returns all the scraped products as a JSON. Note that this has been added for verification purposes only.
- `retries`: The amount of times to attempt to scrape a product/site before giving up and ignoring it.
- `maxProductsPerKeyword`: The amount of maximum products to scrape for each keyword.
- `sites`: An array of all sites to scrape, with the URL and keywords for each site.

You can see the supported versions of Amazon in the example configuration at `./config1.json`, or under the `Supported Amazon Sites` in the `Notes` section.

## Local Deployment

Make sure that you can run `docker-compose` and `docker` as a normal user. If not, enter a terminal as root user via `sudo -s` or open as administrator in Windows.

Twitter API needs app's consumer key and consumer secret in order to communicate with the server. Set them in node environment variables `CONSUMER_KEY` and `CONSUMER_SECRET` respectively. Refer [Authentication under Notes section](#Authentication)

To start the tool + MongoDB database (and also the verification API, see `Verification API` under `Notes`) via Docker Compose, open a terminal and run:

```bash
CONSUMER_KEY=<CONSUMER_API_KEY> CONSUMER_SECRET=<CONSUMER_API_SECRET> CONFIG_FILE=1 npm run start:docker
```

`CONFIG_FILE` indicates which configuration file to use. The configuration files are located in `./config` as JSON. See `Configuration` section for more information the available options.

You can rebuild the Docker images if you make a change to the code, by running:

```bash
CONSUMER_KEY=<CONSUMER_API_KEY> CONSUMER_SECRET=<CONSUMER_API_SECRET> CONFIG_FILE=1 npm run start:build
```

### Selecting Other Configuration Files

You can change the configuration file by changing the environment variable `CONFIG_FILE` that is provided when deploying the tool.

Here's an example, in which we only scrape products from Amazon UK and Walmart, and only for the keyword `baby food`.
Also, we set the products to scrape for each keyword to 10, the number of retries is set to 3, and we enable the Verification API. Check `./config/config2.json` to see these options.

To use this alternative configuration, change the config file number to 2. Try running:

```bash
CONSUMER_KEY=<CONSUMER_API_KEY> CONSUMER_SECRET=<CONSUMER_API_SECRET> CONFIG_FILE=2 npm run start:docker
```

## Verification

### For scraper

A simple Express API has been added that serves all the scraped products stored in the DB as a formatted JSON, that you can see in your browser only when `verificationApi` in the configuration file has been set to `true`.

To get the link, run the tool and **while** it is scraping, you would be able to click on an auto-generated link at the top of the output in the terminal. If you click on it, it will open a page in your browser, in which you can see all the products that have been stored in the DB as a plain JSON file. The raw data from the photos is replaced by a placeholder text, to ease readability.

The API will be stopped when the scraping ends.

### For tweets

Once scraping is complete, the docker app container exits but the db container is still running. You can access mongo using shell of this container to validate the persistence of the tweets for the products. 
Another simple way to verify if the tweets are persisted in the database is: 

```bash
MONGO_URL='mongodb://root:password@localhost:28000' npm run verify-tweets
```

This starts an express server. Hit the endpoint `http://localhost:3000/products/{:id}` where id is the product id. This returns all the tweets associated with the product that has been persisted in the mongo database. The id of the product will be available at the end of the logs of the scraper as follows `Fetching tweets for product with id {:id}`
  
Example: http://localhost:3000/products/5eac484807474d0014405af5 

## Linting

To lint the code with [StandardJS](https://standardjs.com/), run:

```bash
npm install
npm run lint
```

To fix the errors, run:
```bash
npm run lint:fix
```

## Notes

### Workflow

The workflow of the tool is as follows:
1. For each site (each Amazon version counts as a different site), gather product URLs to scrape from the search results for each keyword. Continue until there are no more results or the threshold specified with the variable `maxProductsPerKeyword` is reached, whatever happens first.
2. Scrape each product URL from the previous step. Get the details, photos and reviews.
3. Store the result from step 2 into the MongoDB database. If there is a product that shares any identifier and that was updated/created in a previous run of the scraper, then override it. If not, create a new one.
4. For each product in the database, construct the search keys as per [this](#Rules for twitter keyword generation).
5. For each search key, initiate a get request to the twitter client to fetch all tweets.
6. For all tweets upto a maximum number of tweets specified in the twitter-config.json file, store back these tweets to the product collection under socialMedia.
7. Sometimes, the keywords may recur and hence we have used a map to cache the results to prevent making duplicate network calls.

Whenever an error happens in any part of the process, the tool tries again, the number of attempts is defined in the configuration file, under the name `retries`.
If it fails all attempts, it continues to the next product/site.

If you want to scrape 1000 products in total, you can calculate the products to scrape for each individual keyword, by following this formula:

`maxProductsPerKeyword = (1000 / # of sites) / # of keywords`

For example, let's say I have 4 sites and 2 keywords per site, and I want to scrape 1000 products. `maxProductsPerKeyword = (1000 / 4) / 2 = 125`.

For the calculation above, it's important to remember that each Amazon version counts as a different site.

### How Filtering Is Handled

The tool automatically ignores movies, videos, books and sponsored products in any version of Amazon.
This is achieved by looking for a special box of text that only those types of products have, the CSS selector is `[class="a-size-base a-link-normal a-text-bold"]`. For sponsored products, it checks for `[data-component-type="sp-sponsored-result"]`.

No such filtering is implemented for Walmart or FirstCry.

### Product IDs

Due to the fact that each site has different universal IDs for the products, the tool gathers them all and checks every incoming product against all of them, to avoid duplication across sites. A product may have one or many IDs, depending on the availability and the source site.

The product IDs currently captured are: UPC, ASIN, SKU and GTIN.

### If You Get Too Many Errors

Because we don't use rotating proxies, you may need to change you IP manually to continue scraping. Try shutting down your router for 5-10 minutes to get a new IP from your ISP.

### Supported Amazon Sites
- Amazon.com (US)
- Amazon.co.uk (UK)
- Amazon.ca (Canada)
- Amazon.in (India)
- Amazon.sg (Singapore)
- Amazon.ae (United Arab Emirates)

### Twitter API

To search for tweets about the product, Twitter's Standard search API is used.

`https://developer.twitter.com/en/docs/tweets/search/api-reference/get-search-tweets`

**Note:** 
Standard search API will only return tweets for the last 7 days and it limits the number of requests to 450 on a 15-min window. 
Consider buying a premium plan to overcome the above limitations.

**References:** 
https://developer.twitter.com/en/docs/tweets/search/overview
https://developer.twitter.com/en/docs/tweets/search/api-reference/get-search-tweets
https://developer.twitter.com/en/pricing

#### Authentication

For API authentication, an app is created in [twitter developer console](https://developer.twitter.com/en/apps) and 
[OAuth 2.0 Bearer token - Application-only authentication](https://developer.twitter.com/en/docs/basics/authentication/oauth-2-0) is used.

To run the scraper to get tweets, we need to pass the Consumer Api Keys which can be found under `Keys And Tokens` tab under your app in the twitter developer console.  

If user specific context is required, we might need to change the authentication mechanism.

### Rules for twitter keyword generation

A search keyword is a combination of product's brand, group, positive and negative topics.

A product's group is obtained as follows:
- From product name, remove brand name
- Any text within the paranthesis are removed
- All numbers in the name are removed
- The remaining text is split based on ',' and the first match is taken upto a maximum of 3 words
