import mongoose, { Document, Schema } from 'mongoose';

export interface IProcessedTweet extends Document {
  tweetId: string;
  processedAt: Date;
  createdAt: Date;
}

const ProcessedTweetSchema = new Schema<IProcessedTweet>({
  tweetId: { type: String, required: true, unique: true, index: true },
  processedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Create index for efficient queries
ProcessedTweetSchema.index({ tweetId: 1 });
ProcessedTweetSchema.index({ processedAt: -1 });

export default mongoose.models.ProcessedTweet || mongoose.model<IProcessedTweet>('ProcessedTweet', ProcessedTweetSchema);

