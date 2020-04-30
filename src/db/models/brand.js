const { model, Schema } = require('mongoose')

const brandSchema = new Schema({
  name: { type: String, required: true, index: true, unique: true }
})

module.exports = {
  schema: brandSchema,
  model: model('Brand', brandSchema)
}
