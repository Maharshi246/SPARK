import mongoose from 'mongoose';
import User from '../src/models/userModel.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const email = 'maharshipatel246@gmail.com';
  let user = await User.findOne({ email });
  
  if (!user) {
    user = new User({
      display_name: 'Maharshi Patel',
      email: email,
      password: 'OldPassword123!',
      is_email_verified: true,
      current_layer: 'layer_1',
      role: 'student'
    });
    await user.save();
    console.log('User created:', email);
  } else {
    user.is_email_verified = true;
    await user.save();
    console.log('User already exists and is now verified.');
  }

  mongoose.disconnect();
}

run().catch(console.error);
