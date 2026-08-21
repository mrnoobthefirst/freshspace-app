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

// Database Connection
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB Database Connected Successfully'))
  .catch(err => console.log('Running in Fallback Mode / DB Connection Warning:', err.message));

// Schemas
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

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

// Static Hub Data
const HUB_LOCATIONS = [
  { id: 'hub-1', name: 'New Delhi Railway Station (NDLS)', type: 'Railway', totalPods: 6, availablePods: 4 },
  { id: 'hub-2', name: 'Mumbai Central Railway Hub', type: 'Railway', totalPods: 6, availablePods: 2 },
  { id: 'hub-3', name: 'Bengaluru Airport Terminal 1', type: 'Airport', totalPods: 8, availablePods: 5 },
  { id: 'hub-4', name: 'Varanasi Pilgrimage Express Center', type: 'Pilgrimage', totalPods: 4, availablePods: 1 },
  { id: 'hub-5', name: 'Yamuna Expressway Plaza Hub', type: 'Highway', totalPods: 6, availablePods: 6 }
];

const PRICING_TIERS = {
  express: { name: 'Express Restroom', duration: 10, price: 49 },
  quick: { name: 'Quick Refresh', duration: 20, price: 199 },
  full: { name: 'Full Shower & Kit', duration: 35, price: 349 },
  executive: { name: 'Executive Transit Pass', duration: 60, price: 2499 }
};

// Auth Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'Access Denied' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ success: false, message: 'Invalid or Expired Token' });
    req.user = user;
    next();
  });
};

// API Routes
app.get('/api/hubs', (req, res) => {
  res.json({ success: true, hubs: HUB_LOCATIONS });
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

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
    res.status(500).json({ success: false, message: 'Server error during registration' });
  }
});

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
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
});

app.post('/api/book-pod', (req, res) => {
  const { hubId, tier, timeSlot, passengerName } = req.body;
  const hub = HUB_LOCATIONS.find(h => h.id === hubId);
  const selectedTier = PRICING_TIERS[tier] || PRICING_TIERS.quick;

  if (!hub || hub.availablePods <= 0) {
    return res.status(400).json({ success: false, message: 'No pods available at selected hub.' });
  }

  hub.availablePods -= 1;
  const newBooking = {
    bookingId: 'FS-' + Math.floor(100000 + Math.random() * 900000),
    passengerName: passengerName || 'Guest Traveler',
    hubName: hub.name,
    tierName: selectedTier.name,
    duration: selectedTier.duration,
    amount: selectedTier.price,
    timeSlot,
    createdAt: new Date().toISOString()
  };

  res.json({
    success: true,
    booking: newBooking,
    qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${newBooking.bookingId}`
  });
});

app.post('/api/calculate-financials', (req, res) => {
  const { dailyBookingsPerRoom = 8, numPods = 6 } = req.body;
  const avgTicketPrice = 260;
  const fixedOpex = 135000;
  const monthlyRevenue = Math.round(dailyBookingsPerRoom * numPods * 30 * (avgTicketPrice / 6));
  const monthlyProfit = monthlyRevenue - fixedOpex;

  res.json({
    dailyBookingsPerRoom,
    monthlyRevenue,
    fixedOpex,
    monthlyProfit,
    isProfitable: monthlyProfit > 0
  });
});

app.get('/api/user/bookings', authenticateToken, async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    res.json({ success: true, bookings });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch history' });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
