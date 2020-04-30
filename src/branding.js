const connectDB = require('./db/connect')
const Product = require('./db/models/product').model
const Brand = require('./db/models/brand').model

const mainProcess = async () => {
  // Connect to MongoDB
  await connectDB()

  // fetch all brands
  try {
    const brands = (await Brand.find()).map(brand => brand.name)
    const unbrandedProducts = await Product.find({ $or: [{ brand: null }, { brand: '' }] }, { _id: 1, name: 1 })
    for (const product of unbrandedProducts) {
      let brandMatch = false
      for (const brand of brands) {
        if (product.name.toLowerCase().indexOf(brand.toLowerCase()) > -1) {
          // brand name match
          // update the product
          console.log(`Updating product: "${product.name}" with brand: "${brand}"...`)
          await Product.update({ _id: product._id }, { $set: { brand: brand } })
          brandMatch = true
          break
        }
      }

      if (!brandMatch) {
        console.log(`No brand match found for product: "${product.name}".`)
      }
    }
  } catch (e) {
    console.log('branding process failed: ' + e)
  }
  process.exit(0)
}

mainProcess()
