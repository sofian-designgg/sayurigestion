import mongoose from 'mongoose';

export async function connectDatabase() {
  const uri = process.env.MONGO_URL || process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGO_URL (ou MONGODB_URI) est requis.');
  await mongoose.connect(uri);
}
