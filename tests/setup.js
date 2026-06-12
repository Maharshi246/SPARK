import mongoose from 'mongoose';
import app from '../src/index.js';

export const clearDatabase = async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany();
  }
};

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  }
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await mongoose.disconnect();
});
