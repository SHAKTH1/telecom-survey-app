const mongoose = require('mongoose');

const uri = 'mongodb+srv://shakthi:shakthi@cluster0.shxml.mongodb.net/fleet_management_prehoto?retryWrites=true&w=majority';

mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    const userSchema = new mongoose.Schema({
      username: { type: String, required: true, unique: true },
      password: { type: String, required: true }
    }, { collection: 'user_data' });
    
    const User = mongoose.model('User', userSchema);

    // Replace 'exampleUser' with the username you want to check
    User.findOne({ username: 'FRTTEAM_1' })
      .then(user => {
        if (user) {
          console.log('User found:', user);
        } else {
          console.log('User not found');
        }
        mongoose.disconnect();
      })
      .catch(err => {
        console.error('Error querying the database:', err);
        mongoose.disconnect();
      });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
  });
