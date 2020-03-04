# Product Info Scraper

A CLI tool that scrapes the product search results from retail sites and saves them to a database

## Prerequisites
1. Node 
2. MongoDB
2. Docker Engine
2. Docker Compose

## Configuration

All configurations are in `config.json` file:

`MONGO_DB_URL` - The MongoDB connection url
`IMAGE_MAX_BYTES` - The max size of the images that are to be stored in db (16MB is the limit for BSON type in MongoDB)
`LOG_LEVEL` - The log level
`PAGE_NAVIGATION_TIMEOUT` - The maximum number of seconds to wait for a page to load
`SCRAPERS_CONFIG` - Scraper template realted configs. You can configure here possible selectors for each product field (tried in the order they appear in the array)
`WEBSITES_TO_SCRAPE` - The list of websites to scrape. For each one, the scraper template must be scpecified along with the url, maximum number of products to scrape per keyword and the actual keywords. For each keyword, you can specify a category (for amazon and walmart scrapers) so you can narrow the search. 

## Deployment

```bash
sudo docker-compose up
```

Commands for subsequent builds:

```bash
sudo docker-compose build
sudo docker-compose up
```

## Verification steps

After the scraper has finished, you can verify the data in db by using a MongoDB client with a UI or run the following commands:

```bash
sudo docker exec -it mongo mongo
use product_scraper_db
db.products.count()
db.products.findOne({id: <id>})
```

You can get `<id>` from the logs. E.g.:

```
2020-02-27T01:57:15.165Z [info]: Product with id 26845607 was added in db
```

`<id> = 26845607`

An example product document:


```
{
    "_id" : ObjectId("5e5721b996463433dd4df680"),
    "id" : "961313",
    "__v" : 0,
    "userReviews" : [ 
        "Its a nice product, organic and tasty as well. my little one like it.", 
        "I had ordered a trial pack earlier and my 1 year baby girl seemed to enjoy it alot. Plus she had gained weight also. Therefore i had to buy another one. Its hassle free and easy to make and serve. Thank you LittleMoppet for your amazing products. Looking forward to purchase and try other products as well.", 
        "One of the best dry fruit powder ever purchased.Fine powder makes easy to dissolve in. baby food...", 
        "Sss", 
        "I have taken this after viewing all the reviews some was good and some was bad but I will give a chance to this product because everything deserves a first buyer", 
        "I have been using this product since last 3 months and very happy with it. As dry fruit powder is very healthy for growing babies but as a working mother i was finding it very hard to prepare the same at home was also afraid to buy online also due to quality and ingrediants. but then i found little moppet in first cry and as if was mentioned no sugar and any unhygenic product + giving surety of 100% organic i thought to try once and i used that for myself first and it was actually like they mentioned in the packet then i started giving this to my 1year old baby and he is taking it very well also. Thanks to Little Moppet it made my work easy.", 
        "Healthy baby food.. loving it...", 
        "Very healthy product", 
        "Product is good. I mix it in my baby meal. Hope it will benefit the baby.", 
        "Purely organic. Can be more fine powder as my baby found little difficult to swallow in his early 6th month, later no issues.", 
        ...
    ],
    "ratingInfo" : {
        "_id" : ObjectId("5e5721b9205b5714e6269e41"),
        "overallRating" : 4,
        "totalNumberOf5StarRatings" : 50,
        "totalNumberOf4StarRatings" : 24,
        "totalNumberOf3StarRatings" : 13,
        "totalNumberOf2StarRatings" : 6,
        "totalNumberOf1StarRatings" : 10
    },
    "images" : [ 
        {
            "_id" : ObjectId("5e5721b9205b5714e6269e3e"),
            "url" : "https://cdn.fcglcdn.com/brainbees/images/products/438x531/961313a.jpg",
            "data" : {...}
        },
        ...
    ],
    "descriptionDetail" : null,
    "description" : "Boost the nutritional power of your child’s food.\n\nWe all have days when we struggle to get even a little food inside our babies and toddlers. Why not increase the nutrition of their food? So even if they eat only little of it, it would at least be nutrition packed. Just add Little Moppet Food’s Dry Fruits Powder to your child’s food and relax.\n\nThe Dry Fruits Powder not only increases the nutritional value of the baby’s food, it also has weight gaining benefits. Almonds help with brain development, cashew nuts are great for development of muscles and bones, pistachios are high in fibre, turmeric is a natural antiseptic and nutmeg helps the baby sleep better. I bet you want to try it just for the nutmeg ;)\n\nYou can add the Dry Fruits Powder to your child’s milk (not formula), porridge, roti, pancakes, etc. to enhance the health benefit of these foods.A perfect addition to your child’s food and milk to increase nutrition and help weight gain\n\nA powerful combination of almonds, cashew nuts, pistachios, turmeric, saffron and nutmeg\nLovingly made at home in Doctor Mom’s kitchen\nIt does not contain any preservatives, artificial flavors, sugar or salt. It’s 100% Natural and Safe for your child\nShelf Life: 4 months from Manufacturing.\n\nIngredients: Almonds, Cashew Nuts, Pistachios, Turmeric, Saffron and Nutmeg\n\nRecommended Age and How to use:\n\nFor Babies\nDry Fruits Powder can be given to babies above 8 months.\nPlease follow the 3 day rule, add a 1/4 teaspoon of the dry fruits powder to porridge then next day too same amount and then increase it to half teaspoon of powder.\n\nThe Dry Fruits Powder can be added to Porridge, pancakes, Rotis, desserts.\n\nKey Features:\n\n100% Homemade and natural\nOrganic\nNo preservatives\nNo added sugar\nNo salt\nSpecifications:\n\nBrand - Little Moppet Foods\nType - Dry Fruits Powder For Kids\nRecommended Age - 8 to 14 Months\nItems included in the Package:\n100 gm of Dry Fruits Powder For Kids\n\nNote: Mother's milk is best for your baby.\nFSSAI License No: 10019022009346\n\nThe product expiry date will be displayed only when the pincode is entered.\nNote : Mix of Taxes and discount may change depending the amount of tax being borne by the Company. However, the final price as charged from customer will remain same. Taxes collected against every transaction will be paid to the Government by FirstCry.com. Please refer to the Terms of Use for full details.",
    "price" : "399.00",
    "name" : "Little Moppet Baby Foods Dry Fruits Powder For Kids - 100 gm",
    "upc" : null,
    "keyword" : "baby food",
    "url" : "https://www.firstcry.com/little-moppet-foods/little-moppet-baby-foods-dry-fruits-powder-for-kids-100-gm/961313/product-detail",
    "source" : "https://www.firstcry.com"
}
```

## Notes

Subsequent runs of the scraper will bring slightly different search results for the same keyword (at least for amazon's websites) so some products will be new and they will be added in db alongside updating the existing ones.