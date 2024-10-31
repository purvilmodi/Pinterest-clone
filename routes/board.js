const mongoose = require('mongoose');

const boardSchema = new mongoose.Schema({
  title: { 
    type: String,
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true 
  },
  posts: [{ 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'post' 
  }]
});

module.exports = mongoose.model('board', boardSchema);
