const { model, Schema } = require('mongoose')

const ratingSchema = new Schema({
  overall: Number,
  total: { type: Number, required: true },
  fiveStars: { type: Number, required: true },
  fourStars: { type: Number, required: true },
  threeStars: { type: Number, required: true },
  twoStars: { type: Number, required: true },
  oneStars: { type: Number, required: true }
})

module.exports = {
  schema: ratingSchema,
  model: model('Rating', ratingSchema)
}
