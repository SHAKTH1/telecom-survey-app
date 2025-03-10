// server.js
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');  // <-- Import jsonwebtoken

const app = express();
const port = process.env.PORT || 8080;  // Use port 8080

// Replace with a safer secret in production (use environment variables)
const JWT_SECRET = 'shakthi';

// 1) Body parsing & CORS
app.use(bodyParser.json());
app.use(cors());

// 2) Serve login.html at "/" (or your index page)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// 3) Serve static files from "public" directory
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// 4) MongoDB connection
const atlasUri = 'mongodb+srv://shakthi:shakthi@cluster0.shxml.mongodb.net/fleet_management_prehoto?retryWrites=true&w=majority';
mongoose.connect(atlasUri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB (Atlas) connected'))
  .catch(err => console.log(err));

// 5) User schema & model (collection: user_data)
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }
}, { collection: 'user_data' });
const User = mongoose.model('User', userSchema);

// 6) Survey schema & model (if needed)
const surveySchema = new mongoose.Schema({
  stateName: { type: String, required: true },
  districtName: { type: String, required: true },
  blockName: { type: String, required: true },
  siteName: { type: String, required: true },
  latitude: Number,
  longitude: Number,
  surveyDate: { type: Date, default: Date.now }
});
const Survey = mongoose.model('Survey', surveySchema);

// 7) Site Assignment schema & model (collection: site_assignment_punjab)
const siteAssignmentSchema = new mongoose.Schema({
  teamName: { type: String, required: true },
  nodes: [
    {
      type: { type: String, required: true }, // "BQ" or "GP"
      name: { type: String, required: true },
      lat: { type: Number, required: true },
      long: { type: Number, required: true },
      phase: { type: String }  // Added phase field for GP
    }
  ]
}, { collection: 'site_assignment_punjab' });
const SiteAssignment = mongoose.model('SiteAssignment', siteAssignmentSchema);

// 8) Middleware to verify JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// 9) Login endpoint (issue JWT)
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Find user by username in 'user_data'
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials (user not found)' });
    }

    // Compare password with hashed password
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid credentials (wrong password)' });
    }

    // Generate JWT token that expires in 2 hours
    const token = jwt.sign(
      { username: user.username },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    return res.json({
      success: true,
      message: 'Login successful',
      token
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 10) Protected endpoint to submit survey data (if needed)
app.post('/api/survey', authenticateToken, async (req, res) => {
  try {
    const surveyData = new Survey(req.body);
    const savedSurvey = await surveyData.save();
    res.json({ success: true, data: savedSurvey });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 11) Protected endpoint to fetch site assignments for a given team
app.get('/api/site-assignments/:team', authenticateToken, async (req, res) => {
  try {
    const team = req.params.team;
    const assignments = await SiteAssignment.find({ teamName: team });
    res.json({ success: true, data: assignments });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
  
// 12) Test endpoint
app.get('/api', (req, res) => {
  res.send('Telecom Survey App API is running');
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
