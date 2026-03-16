require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const logger = require('./config/logger');
const errorHandler = require('./middleware/errorHandler');

// Initialize database
require('./config/database');

// Register Bull processor
require('./services/workerService');

const app = express();

app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  credentials: true
}));

app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api', require('./routes/documents'));

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});

module.exports = app;