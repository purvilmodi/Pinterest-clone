const mongoose = require('mongoose');

const postSchema = mongoose.Schema({
  board: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "board"
  },
  title: String,
  description: String,
  image: String
});

module.exports = mongoose.model("post", postSchema);
