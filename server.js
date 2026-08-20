const express = require('express');
const path = require('path');

const authRoutes = require('./routes/auth');
const pickupRoutes = require('./routes/pickups');
const userRoutes = require('./routes/users');
const locationRoutes = require('./routes/locations');
const analyticsRoutes = require('./routes/analytics');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/pickups', pickupRoutes);
app.use('/api/users', userRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/analytics', analyticsRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'Waste Pickup Scheduler', time: new Date().toISOString() });
});

// Serve the SPA for any non-API route
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

app.listen(PORT, () => {
  console.log(`Waste Pickup Scheduler running at http://localhost:${PORT}`);
});
