import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Define minimal schemas if they are not already imported correctly
const universitySchema = new mongoose.Schema({ name: String, domain: String, created_at: Date });
const enrollmentTokenSchema = new mongoose.Schema({ token: String, university_id: mongoose.Schema.Types.ObjectId, is_active: Boolean, used_by: mongoose.Schema.Types.ObjectId, created_by: mongoose.Schema.Types.ObjectId, expires_at: Date });

async function runMigration() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected.');

  // Lazy-load models to ensure schemas are registered correctly if ran from root
  const User = (await import('../src/models/userModel.js')).default;
  const Community = (await import('../src/models/communityModel.js')).default;
  const Circle = (await import('../src/models/circleModel.js')).default;
  const University = mongoose.models.University || mongoose.model('University', universitySchema);
  const EnrollmentToken = mongoose.models.EnrollmentToken || mongoose.model('EnrollmentToken', enrollmentTokenSchema);

  try {
    // 1. Ensure Parul University exists
    let parul = await University.findOne({ name: 'Parul University' });
    if (!parul) {
      parul = await University.create({
        name: 'Parul University',
        domain: 'paruluniversity.ac.in',
        created_at: new Date()
      });
      console.log('Created Parul University:', parul._id);
    } else {
      console.log('Parul University found:', parul._id);
    }

    // 2. Ensure Admin user exists to act as token creator
    let admin = await User.findOne({ email: 'admin@spark.com' });
    if (!admin) {
      console.log('Admin user not found. Run create_admin.js first. Using a placeholder or finding any admin.');
      admin = await User.findOne({ role: 'admin' });
      if (!admin) {
        admin = await User.findOne({}); // Fallback
      }
    }

    // 3. Ensure token 0911Z9 exists and is active
    let token = await EnrollmentToken.findOne({ token: '0911Z9' });
    if (!token) {
      token = await EnrollmentToken.create({
        token: '0911Z9',
        university_id: parul._id,
        created_by: admin ? admin._id : null,
        used_by: null,
        is_active: true,
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
      });
      console.log('Created enrollment token 0911Z9');
    } else {
      token.university_id = parul._id;
      token.is_active = true;
      token.used_by = null;
      await token.save();
      console.log('Updated enrollment token 0911Z9');
    }

    // 4. Assign existing communities to Parul
    const commResult = await Community.updateMany(
      { $or: [{ university_id: { $exists: false } }, { university_id: null }] },
      { $set: { university_id: parul._id } }
    );
    console.log(`Updated ${commResult.modifiedCount} communities.`);

    // 5. Assign existing circles to Parul
    const circleResult = await Circle.updateMany(
      { $or: [{ university_id: { $exists: false } }, { university_id: null }] },
      { $set: { university_id: parul._id } }
    );
    console.log(`Updated ${circleResult.modifiedCount} circles.`);

    // 6. Assign existing users to Parul
    const userResult = await User.updateMany(
      { $or: [{ university_id: { $exists: false } }, { university_id: null }] },
      { $set: { university_id: parul._id } }
    );
    console.log(`Updated ${userResult.modifiedCount} users.`);

    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
