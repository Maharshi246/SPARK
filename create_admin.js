import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
dotenv.config();

const userSchema = new mongoose.Schema({
  display_name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'manager', 'admin'], default: 'student' },
  university_id: { type: mongoose.Schema.Types.ObjectId, ref: 'University', default: null },
  is_verified: { type: Boolean, default: false },
  interests: [{ type: String }],
  depth_level: { type: String, enum: ['surface', 'moderate', 'deep'] },
  discussion_style: { type: String, enum: ['explore', 'debate', 'listen'] },
  availability: [{ type: String, enum: ['morning', 'afternoon', 'evening', 'night'] }],
  current_stage: { type: String, enum: ['layer_1', 'layer_2', 'layer_3'], default: 'layer_1' },
  stage_started_at: { type: Date, default: Date.now },
  layer_history: [{
    layer: { type: String, enum: ['layer_1', 'layer_2', 'layer_3'] },
    changed_at: { type: Date, default: Date.now }
  }],
  communities_joined: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Community' }],
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    const hashedPassword = await bcrypt.hash('Admin123!', 10);

    const result = await User.findOneAndUpdate(
      { email: 'admin@spark.com' },
      {
        display_name: 'Administrator',
        password: hashedPassword,
        role: 'admin',
        is_verified: true,
        current_stage: 'layer_1',
        layer_history: [{ layer: 'layer_1', changed_at: new Date() }]
      },
      { upsert: true, new: true }
    );

    console.log('Admin user ready:', result.email, result.role);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
