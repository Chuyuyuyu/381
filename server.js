const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Use CORS middleware
app.use(cors());

// Set the view engine to EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Provide images from the public folder
app.use(express.static(path.join(__dirname, 'public')));

// Body parser middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Session middleware
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: false
}));

// MongoDB Atlas Connection
const dbURI = 'mongodb+srv://zyh861599401:020909Zyh@cluster0.fhal2.mongodb.net/Project?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(dbURI, {
})
.then(() => console.log('Connected to MongoDB Atlas'))
.catch(err => console.log('Error connecting to MongoDB Atlas: ' + err));

// User model
const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});

const User = mongoose.model('User', UserSchema);

// Friend model
const FriendSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    name: { type: String, required: true },
    email: { type: String, required: true },
    note: { type: String }
});

const Friend = mongoose.model('Friend', FriendSchema);

// Routing - Root Path
app.get('/', (req, res) => {
    res.redirect('/login');  // Redirect to login page
});

// Routing - Registration Screen
app.get('/register', (req, res) => {
    res.render('register', { error: null });
});

// Routing - Registration Process
app.post('/register', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.render('register', { error: 'Email already registered' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({ name, email, password: hashedPassword });
        await newUser.save();
        res.redirect('/login');
    } catch (err) {
        res.render('register', { error: 'Error registering user' });
    }
});

// Routing - Displaying the Login Interface
app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

// Routing - Login Processing
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            if (req.headers['content-type'] === 'application/json') {
                return res.status(404).json({ error: 'User not found' });
            }
            return res.render('login', { error: 'User not found' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            if (req.headers['content-type'] === 'application/json') {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
            return res.render('login', { error: 'Invalid credentials' });
        }

        req.session.user = user;
        if (req.headers['content-type'] === 'application/json') {
            return res.json({ message: 'Login successful' });
        }
        res.redirect('/dashboard');
    } catch (err) {
        if (req.headers['content-type'] === 'application/json') {
            return res.status(500).json({ error: 'Error logging in user' });
        }
        res.render('login', { error: 'Error logging in user' });
    }
});

// Routing - Dashboard page (access after logging in)
app.get('/dashboard', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');  // If you are not logged in, redirect to the login page
    }
    try {
        const friends = await Friend.find({ userId: req.session.user._id });
        res.render('dashboard', { user: req.session.user, friends: friends, backgroundImage: '/images/3.jpg', error: null });
    } catch (err) {
        console.error('Error fetching user data:', err);
        res.redirect('/login');
    }
});

// Routing - Add Friends
app.post('/friends/add', async (req, res) => {
    const { name, email, note } = req.body;
    if (!req.session.user) {
        return res.redirect('/login');
    }

    try {     
        const existingUser = await User.findOne({ email });
        if (!existingUser) {
            const friends = await Friend.find({ userId: req.session.user._id });
            return res.render('dashboard', { user: req.session.user, friends: friends, backgroundImage: '/images/3.jpg', error: 'Friend does not exist in the system' });
        }
    
        const existingFriend = await Friend.findOne({ email, userId: req.session.user._id });
        if (existingFriend) {
            const friends = await Friend.find({ userId: req.session.user._id });
            return res.render('dashboard', { user: req.session.user, friends: friends, backgroundImage: '/images/3.jpg', error: 'Friend already exists' });
        }

        const newFriend = new Friend({ userId: req.session.user._id, name, email, note });
        await newFriend.save();
        res.redirect('/dashboard');
    } catch (err) {
        console.error('Error adding friend:', err);
        res.redirect('/dashboard');
    }
});

// Routing - Displaying the Friends List Page
app.get('/friends/list', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');  // If you are not logged in, redirect to the login page
    }
    try {
        const friends = await Friend.find({ userId: req.session.user._id });
        res.render('friends_list', { friends, user: req.session.user, backgroundImage: '/images/4.jpg' });
    } catch (err) {
        console.error('Error fetching friends:', err);
        res.redirect('/dashboard');
    }
});

// Routing - Edit Friends Page
app.get('/friends/edit/:friendId', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    try {
        const friend = await Friend.findById(req.params.friendId);
        res.render('edit_friend', { friend });
    } catch (err) {
        console.error('Error fetching friend:', err);
        res.redirect('/dashboard');
    }
});

// Routing - Update friend information
app.post('/friends/edit/:friendId', async (req, res) => {
    const { name, email, note } = req.body;
    if (!req.session.user) {
        return res.redirect('/login');
    }
    try {
        await Friend.findByIdAndUpdate(req.params.friendId, { name, email, note });
        res.redirect('/friends/list'); // Jump to friends list
    } catch (err) {
        console.error('Error updating friend:', err);
        res.redirect('/dashboard');
    }
});

// Routing - Deleting Friends
app.post('/friends/delete/:friendId', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    try {
        await Friend.findByIdAndDelete(req.params.friendId);
        res.redirect('/dashboard');
    } catch (err) {
        console.error('Error deleting friend:', err);
        res.redirect('/dashboard');
    }
});

// Get all friends (API)
app.get('/api/friends', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    try {
        const friends = await Friend.find({ userId: req.session.user._id });
        res.json(friends);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching friends', error: err });
    }
});

// Add a new friend (API)
app.post('/api/friends', async (req, res) => {
    const { name, email, note } = req.body;
    if (!req.session.user) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    try {
        const existingUser = await User.findOne({ email });
        if (!existingUser) {
            return res.status(400).json({ message: 'Friend does not exist in the system' });
        }

        const existingFriend = await Friend.findOne({ email, userId: req.session.user._id });
        if (existingFriend) {
            return res.status(400).json({ message: 'Friend already exists' });
        }

        const newFriend = new Friend({ userId: req.session.user._id, name, email, note });
        await newFriend.save();
        res.status(201).json(newFriend);
    } catch (err) {
        res.status(500).json({ message: 'Error adding friend', error: err });
    }
});

// Update a friend (API)
app.put('/api/friends/:friendId', async (req, res) => {
    const { name, email, note } = req.body;
    if (!req.session.user) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    try {
        const updatedFriend = await Friend.findByIdAndUpdate(req.params.friendId, { name, email, note }, { new: true });
        if (!updatedFriend) {
            return res.status(404).json({ message: 'Friend not found' });
        }
        res.json(updatedFriend);
    } catch (err) {
        res.status(500).json({ message: 'Error updating friend', error: err });
    }
});

// Delete a friend (API)
app.delete('/api/friends/:friendId', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    try {
        const deletedFriend = await Friend.findByIdAndDelete(req.params.friendId);
        if (!deletedFriend) {
            return res.status(404).json({ message: 'Friend not found' });
        }
        res.json({ message: 'Friend deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Error deleting friend', error: err });
    }
});

// Routing - Logout
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            res.status(500).send('Error logging out');
        } else {
            res.redirect('/login');
        }
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

