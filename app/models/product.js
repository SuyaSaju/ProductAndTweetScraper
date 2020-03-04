const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({ 
  overallRating: Number,
  totalNumberOf5StarRatings: Number,
  totalNumberOf4StarRatings: Number,
  totalNumberOf3StarRatings: Number,
  totalNumberOf2StarRatings: Number,
  totalNumberOf1StarRatings: Number
});

const productSchema = new mongoose.Schema({
  id: {type: String, unique: true, sparse: true},
  upc: String,
  source: String,
  url: String,
  keyword: String,
  name: String,
  description: String,
  descriptionDetail: String,
  price: String,
  ratingInfo: ratingSchema,
  userReviews: [String],
  images: [{
    data: Buffer,
    contentType: String,
    url: String
  }]
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;