const mongoose = require('mongoose')

module.exports = () => {
  return new Promise((resolve, reject) => {
    const mongoDBUrl = 'mongodb://root:password@db:27017'
    mongoose.connect(process.env.MONGO_URL || mongoDBUrl, { useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false })
    const db = mongoose.connection
    db.on('error', function (err) {
      console.error.bind(console, 'connection error:')
      reject(err)
    })
    db.once('open', function () {
      resolve()
    })
  })
}
