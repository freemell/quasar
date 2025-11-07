import mongoose, { Document, Schema } from 'mongoose';

export interface IQueuedReply extends Document {
  tweetId: string;
  replyText: string;
  replyToTweetId: string;
  txHash: string;
  attempts: number;
  lastAttemptAt: Date;
  nextRetryAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const QueuedReplySchema = new Schema<IQueuedReply>({
  tweetId: { type: String, required: true, unique: true, index: true },
  replyText: { type: String, required: true },
  replyToTweetId: { type: String, required: true },
  txHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  lastAttemptAt: { type: Date, default: Date.now },
  nextRetryAt: { type: Date, required: true, index: true },
  status: { 
    type: String, 
    enum: ['pending', 'processing', 'completed', 'failed'], 
    default: 'pending',
    index: true
  },
  error: { type: String }
}, {
  timestamps: true
});

export default mongoose.models.QueuedReply || mongoose.model<IQueuedReply>('QueuedReply', QueuedReplySchema);

