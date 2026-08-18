import mongoose from 'mongoose';

export async function connectMongo() {
  await mongoose.connect(process.env.MONGODB_URI);
}

export function isMongoConnected() {
  return mongoose.connection.readyState === 1;
}
