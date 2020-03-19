# Infant Nutrition - Product Scraper Tool
Deployment Guide

### Description

Scrape products and their photos and reviews from Amazon (.com, .co.uk, .ca, .in, .sg and .ae), Walmart and FirstCry, and store the results in a MongoDB database.

## Prerequisites
1. Node 13.x
2. Docker & Docker-Compose

## Configuration

The configuration, such as sites to scrape and keywords, is provided to the tool via JSON configuration files, located in `./config`.

It's important to note that each version of Amazon counts as a different site, and the provided keywords are scraped independently for each site. Take that into account when choosing the products to scrape for each keyword. For more information on the workflow of the tool, check the `Workflow` section under `Notes`.

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

To start the tool + MongoDB database (and also the verification API, see `Verification API` under `Notes`) via Docker Compose, open a terminal and run:

```bash
CONFIG_FILE=1 npm run start:docker
```

`CONFIG_FILE` indicates which configuration file to use. The configuration files are located in `./config` as JSON. See `Configuration` section for more information the available options.

You can rebuild the Docker images if you make a change to the code, by running:

```bash
CONFIG_FILE=1 npm run start:build
```

### Selecting Other Configuration Files

You can change the configuration file by changing the environment variable `CONFIG_FILE` that is provided when deploying the tool.

Here's an example, in which we only scrape products from Amazon UK and Walmart, and only for the keyword `baby food`.
Also, we set the products to scrape for each keyword to 10, the number of retries is set to 3, and we enable the Verification API. Check `./config/config2.json` to see these options.

To use this alternative configuration, change the config file number to 2. Try running:

```bash
CONFIG_FILE=2 npm run start:docker
```

## Verification

Once the tool starts scraping the provided sites and keywords, you will see a link at the top of the terminal.

If you click on it, it will open a page in your browser, in which you can see all the products that have been stored in the DB as a plain JSON file.

The raw data from the photos is replaced by a placeholder text, to ease readability.

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

### Verification API

I have taken the freedom to add a very simple Express API that serves all the scraped products stored in the DB as a formatted JSON, that you can see in your browser.

If you have set `verificationApi` in the configuration file to `true`, then it will be accesible.

To get the link, run the tool and **while** it is scraping, you would be able to click on an auto-generated link at the top of the output in the terminal.

The API will be stopped when the scraping ends.

### Workflow

The workflow of the tool is as follows:
1. For each site (each Amazon version counts as a different site), gather product URLs to scrape from the search results for each keyword. Continue until there are no more results or the threshold specified with the variable `maxProductsPerKeyword` is reached, whatever happens first.
2. Scrape each product URL from the previous step. Get the details, photos and reviews.
3. Store the result from step 2 into the MongoDB database. If there is a product that shares any identifier and that was updated/created in a previous run of the scraper, then override it. If not, create a new one.

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
