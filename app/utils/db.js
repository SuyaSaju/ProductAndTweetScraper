const mongoose = require('mongoose');
const config = require('../../config');
mongoose.connect(config.MONGO_DB_URL, { useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true, useFindAndModify: false });
mongoose.connection.on('error', console.error.bind(console, 'MongoDB connection error:'));