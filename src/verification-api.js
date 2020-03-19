const express = require('express')

const Product = require('./db/models/product').model

module.exports = async () => {
  const app = express()
  app.get('/', (_, response) => {
    Product.find({}, (_, res) => {
      // Turn image buffer into more friendly string to be displayed
      const filteredResult = JSON.stringify(res, null, 4).replace(/(?<="data": \[).*?(?=\])/gs, '(hidden to ease verification)').replace('<', '&lt;').replace('>', '&gt;')
      response.setHeader('content-type', 'application/json')
      response.send(filteredResult)
    })
  })
  app.listen(3000, () => {
    console.log(`Verification API listening on http://${require('os').networkInterfaces().eth0[0].address}:3000`)
    console.log('')
  })
}
