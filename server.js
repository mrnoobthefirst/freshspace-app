const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Mock Database State
const HUB_LOCATIONS = [
    { id: 'hub-1', name: 'New Delhi Railway Station (NDLS)', type: 'Railway', totalPods: 6, availablePods: 4 }, //
    { id: 'hub-2', name: 'Mumbai Central Railway Hub', type: 'Railway', totalPods: 6, availablePods: 2 }, //
    { id: 'hub-3', name: 'Bengaluru Airport Terminal 1', type: 'Airport', totalPods: 8, availablePods: 5 }, //
    { id: 'hub-4', name: 'Varanasi Pilgrimage Express Center', type: 'Pilgrimage', totalPods: 4, availablePods: 1 }, //
    { id: 'hub-5', name: 'Yamuna Expressway Plaza Hub', type: 'Highway', totalPods: 6, availablePods: 6 } //
];

const PRICING_TIERS = {
    express: { name: 'Express Restroom', duration: 10, price: 49 }, //
    quick: { name: 'Quick Refresh', duration: 20, price: 199 }, //
    full: { name: 'Full Shower & Kit', duration: 35, price: 349 }, //
    executive: { name: 'Executive Transit Pass', duration: 60, price: 2499 } //
};

const bookings = [];

// API: Get Live Hub Availability
app.get('/api/hubs', (req, res) => {
    res.json({ success: true, hubs: HUB_LOCATIONS });
});

// API: Financial Model Simulator
app.post('/api/calculate-financials', (req, res) => {
    const { dailyBookingsPerRoom, numPods = 6 } = req.body; //
    const avgTicketPrice = 260; //
    const fixedOpex = 135000; //

    const monthlyRevenue = Math.round(dailyBookingsPerRoom * numPods * 30 * (avgTicketPrice / 6));
    const monthlyProfit = monthlyRevenue - fixedOpex; //

    res.json({
        dailyBookingsPerRoom,
        monthlyRevenue,
        fixedOpex,
        monthlyProfit,
        isProfitable: monthlyProfit > 0
    });
});

// API: Process Reservation & Return QR Ticket
app.post('/api/book-pod', (req, res) => {
    const { hubId, tier, timeSlot, passengerName } = req.body;

    const hub = HUB_LOCATIONS.find(h => h.id === hubId);
    const selectedTier = PRICING_TIERS[tier];

    if (!hub || hub.availablePods <= 0) {
        return res.status(400).json({ success: false, message: 'No pods available at selected hub.' });
    }

    // Decrement inventory
    hub.availablePods -= 1;

    const newBooking = {
        bookingId: 'FS-' + Math.floor(100000 + Math.random() * 900000),
        passengerName,
        hubName: hub.name,
        tierName: selectedTier.name,
        duration: selectedTier.duration, //
        amount: selectedTier.price, //
        timeSlot,
        createdAt: new Date().toISOString()
    };

    bookings.push(newBooking);

    res.json({
        success: true,
        booking: newBooking,
        qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${newBooking.bookingId}`
    });
});

app.listen(PORT, () => {
    console.log(`FRESHSPACE Server running at http://localhost:${PORT}`);
});