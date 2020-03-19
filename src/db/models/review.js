const { model, Schema } = require('mongoose')

const reviewSchema = new Schema({
  name: String,
  rating: Number,
  title: String,
  date: Date,
  isVerifiedPurchase: Boolean,
  textContent: String,
  foundHelpful: Number
})

module.exports = {
  schema: reviewSchema,
  model: model('Review', reviewSchema)
}
