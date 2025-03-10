// create_account.js
const mongoose = require('mongoose');
const process = require('process');
const bcrypt = require('bcrypt');

// Updated connection string: using the new DB name (fleet_management_prehoto)
const uri = 'mongodb+srv://shakthi:shakthi@cluster0.shxml.mongodb.net/fleet_management_prehoto?retryWrites=true&w=majority';

// Connect to MongoDB Atlas
mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Connected to MongoDB Atlas');
    createAccount();
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Define a simple User schema for login credentials
// Updated collection name: user_data
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }
}, { collection: 'user_data' });

const User = mongoose.model('User', userSchema);

async function createAccount() {
  // Expect username and password as command line arguments
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log("Usage: node create_account.js <username> <password>");
    process.exit(1);
  }
  
  const [username, password] = args;
  
  try {
    // 1. Hash the password with bcrypt
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 2. Create the user document with the hashed password
    const user = new User({ username, password: hashedPassword });

    // 3. Save to the database
    await user.save();
    console.log("Account created successfully");
    process.exit(0);
  } catch (err) {
    console.error("Error creating account:", err);
    process.exit(1);
  }
}
