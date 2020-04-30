const { model, Schema } = require('mongoose')

const photoSchema = require('./photo').schema
const reviewSchema = require('./review').schema
const ratingSchema = require('./rating').schema

const productSchema = new Schema({
  scraperRunId: { type: String, required: true },
  lastUpdated: Date,
  productUrl: String,
  upc: Number,
  sku: String,
  gtin: Number,
  asin: String,
  source: String,
  brand: String,
  name: String,
  description: String,
  descriptionDetail: String,
  price: Object,
  photos: [photoSchema],
  reviews: [reviewSchema],
  rating: ratingSchema,
  keywordRank: Object
})

module.exports = {
  schema: productSchema,
  model: model('Product', productSchema)
}
