const express = require('express')
const connectDB = require('./db/connect')

const Product = require('./db/models/product').model

const runServer = async () => {
  const app = express()
  app.get('/products/:id', async (request, response) => {
    await connectDB()
    try {
      const product = await Product.findOne({ _id: request.params.id })
      response.send(product.socialMedia.twitter)
    } catch (e) {
      response.send('Unable to fetch product')
    }
  })
  app.listen(3000, () => {
    console.log('Server started...')
    console.log('To find tweets for a product, hit http://localhost:3000/products/{:_id}')
  })
}

runServer()
