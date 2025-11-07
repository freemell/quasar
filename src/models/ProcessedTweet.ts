import mongoose, { Document, Schema } from 'mongoose';

export interface IProcessedTweet extends Document {
  tweetId: string;
  processedAt: Date;
  createdAt: Date;
}

const ProcessedTweetSchema = new Schema<IProcessedTweet>({
  tweetId: { type: String, required: true, unique: true }, // unique already creates an index
  processedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Create index for efficient queries (only for processedAt, tweetId already has unique index)
ProcessedTweetSchema.index({ processedAt: -1 });

export default mongoose.models.ProcessedTweet || mongoose.model<IProcessedTweet>('ProcessedTweet', ProcessedTweetSchema);

