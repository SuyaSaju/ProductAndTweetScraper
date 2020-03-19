const { model, Schema } = require('mongoose')

const photoSchema = new Schema({
  url: { type: String, required: true },
  data: { type: Buffer, required: true }
})

module.exports = {
  schema: photoSchema,
  model: model('Photo', photoSchema)
}
