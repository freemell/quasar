# X (Twitter) API Use Cases for Quasar

## Application Overview
Quasar is a blockchain-based tipping platform that enables users to send BNB (Binance Smart Chain) tips to any X (Twitter) post through the @Quasartip bot. The platform integrates X's API to monitor mentions, process tip commands, and provide real-time transaction confirmations.

## Specific Use Cases

### 1. **Mention Monitoring & Tip Command Processing**
**Purpose**: Monitor real-time mentions of @Quasartip to detect and process tip commands from users.

**Implementation**:
- Continuously search for tweets mentioning "@Quasartip" using the Search Tweets API
- Parse tip commands in various formats:
  - "@Quasartip tip 0.01 bnb to @username"
  - "@Quasartip tip 0.01 to @username"
  - "@Quasartip tip @username 0.01 bnb" (legacy format still supported)
- Extract sender, recipient, amount, and token type from tweet text
- Process batched tips (multiple tips from same sender to same recipient) into single blockchain transactions

**API Endpoints Used**:
- `GET /2/tweets/search/recent` - Search for mentions
- `GET /2/tweets/search/stream` - Real-time mention monitoring (if available)

**Data Retrieved**:
- Tweet ID, text, author_id, created_at
- User information (username, name) via expansions
- Public metrics (likes, retweets) for giveaway functionality

---

### 2. **Automated Tweet Replies & Transaction Confirmations**
**Purpose**: Post automated replies to users confirming successful tip transactions, errors, or status updates.

**Implementation**:
- Reply to original tip tweets with transaction confirmations
- Include transaction hash and BscScan link for transparency
- Send error messages when transactions fail
- Notify recipients when tips are sent to their custodial wallets
- Post giveaway completion messages with winner details

**API Endpoints Used**:
- `POST /2/tweets` - Create tweets with reply context

**Content Posted**:
- Success messages: "✅ Tip sent! 0.01 BNB sent to @username\nTx: [hash]\nView on BscScan: [link]"
- Error messages: "❌ Error processing tip: [error details]"
- Giveaway results: "🎉 Giveaway complete! X winners selected and tipped [amount] BNB each!"
- Claim notifications: "@username has claimed their tip after signing up on quasar.tips"

---

### 3. **User Profile Lookup & Authentication**
**Purpose**: Retrieve user information by handle or Twitter ID for account creation and wallet association.

**Implementation**:
- Look up users by username/handle when they sign up
- Retrieve Twitter ID for account linking
- Fetch profile images, names, and public metrics
- Validate user identity for wallet creation

**API Endpoints Used**:
- `GET /2/users/by/username/:username` - Get user by username
- `GET /2/users/:id` - Get user by ID

**Data Retrieved**:
- User ID, username, name
- Profile image URL
- Description/bio
- Public metrics (followers, following, tweet count)

---

### 4. **Conversation Thread Analysis for Giveaways**
**Purpose**: Analyze conversation threads to identify replies for giveaway functionality.

**Implementation**:
- Search for all replies in a conversation thread
- Filter replies based on giveaway criteria (random, first, highest engagement)
- Extract reply authors for winner selection
- Process multiple winners in a single transaction batch

**API Endpoints Used**:
- `GET /2/tweets/search/recent` - Search by conversation_id
- `GET /2/tweets/:id` - Get specific tweet details

**Data Retrieved**:
- Conversation ID
- Reply tweets with author information
- Public metrics (likes, retweets) for engagement-based selection
- Tweet timestamps for chronological selection

---

### 5. **Follow Status Verification**
**Purpose**: Verify if users follow each other for potential auto-pay or conditional tip features.

**Implementation**:
- Check if a user follows another user
- Enable conditional tipping based on follow status
- Support auto-pay rules that require follow relationships

**API Endpoints Used**:
- `GET /2/users/:id/followers` - Get user's followers list
- `GET /2/users/:id/following` - Get users a user is following

**Use Case**:
- Verify follow relationships before processing conditional tips
- Enable "tip if following" auto-pay rules

---

### 6. **Real-time Bot Activity Monitoring**
**Purpose**: Monitor bot activity and ensure all mentions are processed in a timely manner.

**Implementation**:
- Poll for new mentions every 2 minutes (via cron job)
- Track processed tweets to avoid duplicates
- Monitor bot health and API rate limits
- Log all interactions for debugging and analytics

**API Endpoints Used**:
- `GET /2/tweets/search/recent` - Regular polling
- Rate limit monitoring via response headers

---

## Technical Requirements

### Rate Limits Needed
- **Tweet Search**: Minimum 300 requests per 15 minutes (for mention monitoring)
- **Tweet Creation**: Minimum 300 requests per 15 minutes (for replies)
- **User Lookup**: Minimum 300 requests per 15 minutes (for profile retrieval)
- **Followers/Following**: Minimum 15 requests per 15 minutes (for follow verification)

### Required Permissions
- **Read Tweets**: To search and read mentions
- **Write Tweets**: To post replies and confirmations
- **Read Users**: To lookup user profiles and information
- **Read Follows**: To verify follow relationships

### API Version
- **Twitter API v2** (Primary)
- OAuth 1.0a for authenticated requests (tweet posting)
- Bearer token for read-only requests (search, user lookup)

---

## User Experience Flow

1. **User sends tip**: "@Quasartip tip 0.01 bnb to @recipient"
2. **Bot detects mention**: Searches for mentions every 2 minutes
3. **Bot processes tip**: Validates sender, creates recipient wallet if needed, executes blockchain transaction
4. **Bot replies**: Posts confirmation tweet with transaction hash and BscScan link
5. **Recipient notified**: Receives reply notification and can view transaction on BscScan

---

## Compliance & Best Practices

- All automated tweets clearly identify the bot account (@Quasartip)
- Replies are contextual and directly related to the original tweet
- Transaction hashes provide transparency and verifiability
- Error messages are helpful and non-spammy
- Rate limits are respected with appropriate polling intervals
- User privacy is maintained (only public data is accessed)

---

## Expected API Usage Volume

- **Mention searches**: ~720 requests/day (every 2 minutes)
- **Tweet replies**: ~50-200 tweets/day (depending on tip volume)
- **User lookups**: ~100-300 requests/day (for new users and verification)
- **Follow checks**: ~10-50 requests/day (for conditional features)

**Total estimated**: ~1,000-1,500 API requests per day

---

This application uses the X API exclusively for legitimate tipping functionality, providing transparency and automation for blockchain-based microtransactions on the X platform.

