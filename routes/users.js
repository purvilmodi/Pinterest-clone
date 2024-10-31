const mongoose = require('mongoose');
const plm = require("passport-local-mongoose");

mongoose.connect("mongodb://127.0.0.1:27017/pin");

const userSchema = mongoose.Schema({
  username: String,
  name: String,
  email: String,
  password: String,
  profileImage: String,
  contact: Number,
  board: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "board"
  }]
});

userSchema.plugin(plm);

module.exports = mongoose.model("user", userSchema);
