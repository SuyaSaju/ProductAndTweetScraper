const mongoose = require('mongoose')

module.exports = () => {
  return new Promise((resolve, reject) => {
    mongoose.connect('mongodb://root:password@localhost:28000', { useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false })
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
