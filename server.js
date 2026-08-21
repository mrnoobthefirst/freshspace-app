const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'freshspace_super_secret_key_2026';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/freshspace';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB (Render or Local)
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB Database Connected Successfully'))
  .catch(err => console.log('Running in Local DB Fallback Mode:', err.message));

// User Schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Booking Schema
const bookingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bookingId: { type: String, required: true },
  hubName: { type: String, required: true },
  tierName: { type: String, required: true },
  duration: { type: Number, required: true },
  amount: { type: Number, required: true },
  timeSlot: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Booking = mongoose.model('Booking', bookingSchema);

// Auth Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'Access Denied. Please Login.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ success: false, message: 'Invalid or Expired Token' });
    req.user = user;
    next();
  });
};

// --- AUTH ROUTES ---

// Signup Route
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ success: false, message: 'Email already registered' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword });
    await user.save();

    const token = jwt.sign({ userId: user._id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ success: true, token, user: { name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Login Route
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ success: false, message: 'User not found' });

    const validPass = await bcrypt.compare(password, user.password);
    if (!validPass) return res.status(400).json({ success: false, message: 'Invalid password' });

    const token = jwt.sign({ userId: user._id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ success: true, token, user: { name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// --- APPLICATION & BOOKING ROUTES ---

// Create Booking (Protected Route)
app.post('/api/bookings', authenticateToken, async (req, res) => {
  try {
    const { hubName, tierName, duration, amount, timeSlot } = req.body;
    const bookingId = 'FS-' + Math.floor(100000 + Math.random() * 900000);

    const booking = new Booking({
      userId: req.user.userId,
      bookingId,
      hubName,
      tierName,
      duration,
      amount,
      timeSlot
    });

    await booking.save();
    res.json({ success: true, booking });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to complete booking' });
  }
});

// Fetch Logged-in User Bookings (Protected Route)
app.get('/api/user/bookings', authenticateToken, async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    res.json({ success: true, bookings });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch history' });
  }
});

app.listen(PORT, () => console.log(`FRESHSPACE Full-Stack App running on port ${PORT}`));
