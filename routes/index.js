var express = require('express');
var router = express.Router();
const userModel = require("./users");
const postModel = require("./post");
const boardModel = require("./board");
const passport = require('passport');
const localStrategy = require('passport-local');
const upload = require("./multer");
const { check, validationResult } = require('express-validator');

passport.use(new localStrategy(userModel.authenticate()));

router.get('/', function(req, res, next) {
  res.render('index', { nav: false, error: req.flash('error') });
});

router.get('/edit', isLoggedIn, async (req, res) => {
  try {
    const user = await userModel.findOne({ username: req.session?.passport?.user });
    if (!user) {
      return res.status(404).send('User not found');
    }
    res.render('edit', { user, nav: true });
  } catch (err) {
    res.status(500).send('Error finding user');
  }
});

router.post('/edit', isLoggedIn, async (req, res) => {
  const { name, username, email, password, contact } = req.body;
  try {
    const user = await userModel.findOne({ username: req.session?.passport?.user });
    if (!user) {
      return res.status(404).send('User not found');
    }
    
    const updatedUser = await userModel.findByIdAndUpdate(
      user._id,
      { name, username, email, password, contact },
      { new: true }
    );

    res.redirect('/profile');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error updating user');
  }
});

router.get('/register', function(req, res, next) {
  res.render('register', { nav: false, error: req.flash('error') });
});

router.get('/profile', isLoggedIn, async function(req, res, next) {
  try {
    const user = await userModel.findOne({ username: req.session?.passport?.user })
      .populate({
        path: 'board',
        populate: {
          path: 'posts' // Populate the posts of each board
        }
      });
    
    if (!user) {
      return res.status(404).send('User not found');
    }
    res.render('profile', { user, nav: true });
  } catch (error) {
    res.status(500).send('Error loading profile');
  }
});

router.get('/show/posts', isLoggedIn, async function(req, res, next) {
  try {
    // Retrieve the user and populate boards with their posts
    const user = await userModel.findOne({ username: req.session?.passport?.user })
                                  .populate({ path: 'board', populate: { path: 'posts' } });

    if (!user) {
      return res.status(404).send('User not found');
    }

    const boardId = req.query.boardId; // Get the board ID from query parameters
    const board = user.board.find(b => b._id.toString() === boardId); // Find the specified board

    if (!board) {
      return res.status(404).send('Board not found');
    }

    console.log("Board Posts:", board.posts); // Debugging: log the posts
    res.render('show', { user, board, nav: true });
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).send('Internal Server Error');
  }
});

router.delete("/board/:id", async (req, res) => {
  try {
    const boardId = req.params.id;

    // Delete all posts associated with the board
    await postModel.deleteMany({ board: boardId });

    // Delete the board itself
    await boardModel.findByIdAndDelete(boardId);

    res.status(200).send("Board deleted successfully");
  } catch (error) {
    console.error("Error deleting board:", error);
    res.status(500).send("Failed to delete board");
  }
});

router.get('/delete/:id', async (req, res) => {
  try {
    const postId = req.params.id;

    // Find the post to get the board ID
    const post = await postModel.findById(postId);
    if (!post) {
      return res.status(404).send('Post not found');
    }

    const boardId = post.board; // Save the board ID for redirection after deletion

    // Delete the post
    await postModel.findByIdAndDelete(postId);

    // Remove the post ID from the board's posts array
    await boardModel.updateOne(
      { _id: boardId },
      { $pull: { posts: postId } }
    );

    // Redirect to the show posts page for the same board
    res.redirect(`/show/posts?boardId=${boardId}`);
  } catch (error) {
    console.error('Error deleting post:', error);
    res.redirect('/show/posts'); // Redirect even on error
  }
});

router.get('/feed', isLoggedIn, async function(req, res, next) {
  try {
    // Fetch the logged-in user
    const user = await userModel.findOne({ username: req.session?.passport?.user });
    if (!user) {
      return res.status(404).send('User not found');
    }

    // Find all posts and populate board and user information
    const posts = await postModel
      .find()
      .populate({
        path: 'board',
        populate: {
          path: 'user',
          model: 'user' // Populate the user within each board
        }
      });

    // Render the feed page with the user and posts data
    res.render('feed', { user, posts, nav: true });
  } catch (error) {
    console.error('Error loading feed:', error);
    res.status(500).send('Error loading feed');
  }
});

router.get('/add', isLoggedIn, async function(req, res, next) {
  try {
    const user = await userModel.findOne({ username: req.session?.passport?.user });
    if (!user) {
      return res.status(404).send('User not found');
    }
    
    const boardId = req.query.boardId; // Get boardId from query parameters
    res.render('add', { user, nav: true, boardId }); // Pass boardId to the view
  } catch (error) {
    res.status(500).send('Error loading add post page');
  }
});

router.post('/board', isLoggedIn, async function(req, res, next) {
  try {
    const user = await userModel.findOne({ username: req.session?.passport?.user });
    if (!user) {
      return res.status(404).send('User not found');
    }

    const board = await boardModel.create({
      user: user._id,
      title: req.body.title
    });

    user.board.push(board._id);
    await user.save();
    res.redirect('/profile');
  } catch (error) {
    res.status(500).send('Error creating board');
  }
});

router.post('/createpost', isLoggedIn, upload.single("postimage"), async function(req, res, next) {
  try {
    // Retrieve the logged-in user
    const user = await userModel.findOne({ username: req.session?.passport?.user });
    if (!user) {
      return res.status(404).send('User not found');
    }

    // Get the board ID from the request body
    const boardId = req.body.boardId;
    if (!boardId) {
      return res.status(400).send('Board ID is required');
    }

    // Find the specified board
    const board = await boardModel.findOne({ _id: boardId, user: user._id });
    if (!board) {
      return res.status(404).send('Board not found');
    }

    // Create a new post with the data from the request
    const post = await postModel.create({
      board: board._id,
      title: req.body.title,
      description: req.body.description,
      image: req.file.filename
    });

    // Add the post's ID to the board's posts array
    board.posts.push(post._id);
    await board.save(); // Save the updated board

    res.redirect('/profile');
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).send('Error creating post');
  }
});


router.post('/fileupload', isLoggedIn, upload.single("image"), async function(req, res, next) {
  try {
    const user = await userModel.findOne({ username: req.session?.passport?.user });
    if (!user) {
      return res.status(404).send('User not found');
    }

    user.profileImage = req.file.filename;
    await user.save();
    res.redirect('/profile');
  } catch (error) {
    res.status(500).send('Error uploading file');
  }
});

router.post('/register', function(req, res, next) {
  const { username, email, contact, fullname, password } = req.body;

  if (!username || !email || !contact || !fullname || !password) {
    req.flash('error', 'All fields are required.');
    return res.redirect('/register');
  }

  const data = new userModel({ username, email, contact, name: fullname });

  userModel.register(data, password)
    .then(function () {
      passport.authenticate("local")(req, res, function () {
        res.redirect('/profile');
      });
    })
    .catch(function (err) {
      console.error("Registration error:", err);
      req.flash('error', 'Registration failed: ' + err.message);
      res.redirect('/register');
    });
});

router.post('/login', passport.authenticate("local", {
  failureRedirect: "/",
  successRedirect: "/profile",
  failureFlash: true,
}));

router.get('/logout', function(req, res, next) {
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('/');
  });
});

function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/');
}

module.exports = router;
