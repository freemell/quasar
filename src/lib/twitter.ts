import { TwitterApi } from 'twitter-api-v2';

let client: TwitterApi | null = null;
let bearerClient: any = null;

// Rate limit tracking (in-memory cache)
let rateLimitResetTime: Date | null = null; // For search mentions
let postTweetRateLimitResetTime: Date | null = null; // For posting tweets

function getTwitterClient() {
  if (!client) {
    if (!process.env.TWITTER_API_KEY || !process.env.TWITTER_API_SECRET) {
      throw new Error('Twitter API credentials not configured');
    }
    
    // Check if access tokens are provided (required for write operations)
    if (!process.env.TWITTER_ACCESS_TOKEN || !process.env.TWITTER_ACCESS_SECRET) {
      console.warn('⚠️ Twitter access tokens not configured - write operations will fail');
    }
    
    client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET,
      accessToken: process.env.TWITTER_ACCESS_TOKEN,
      accessSecret: process.env.TWITTER_ACCESS_SECRET,
    });
    
    // Use readOnly for read operations, but client itself has write permissions if access tokens are provided
    bearerClient = client.readOnly;
    
    console.log('✅ Twitter client initialized', {
      hasAccessToken: !!process.env.TWITTER_ACCESS_TOKEN,
      hasAccessSecret: !!process.env.TWITTER_ACCESS_SECRET,
      canWrite: !!(process.env.TWITTER_ACCESS_TOKEN && process.env.TWITTER_ACCESS_SECRET)
    });
  }
  
  return { client, bearerClient };
}

export interface TwitterUser {
  id: string;
  username: string;
  name: string;
  profile_image_url: string;
  description: string;
  public_metrics: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
  };
}

export async function getUserByHandle(handle: string): Promise<TwitterUser | null> {
  try {
    const { bearerClient } = getTwitterClient();
    
    // Remove @ symbol if present
    const cleanHandle = handle.replace('@', '');
    
    const user = await bearerClient.v2.userByUsername(cleanHandle, {
      'user.fields': ['id', 'username', 'name', 'profile_image_url', 'description', 'public_metrics']
    });
    
    if (user.data) {
      return user.data as TwitterUser;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching user by handle:', error);
    return null;
  }
}

export async function getUserProfile(userId: string): Promise<TwitterUser | null> {
  try {
    const { bearerClient } = getTwitterClient();
    
    const user = await bearerClient.v2.user(userId, {
      'user.fields': ['id', 'username', 'name', 'profile_image_url', 'description', 'public_metrics']
    });
    
    if (user.data) {
      return user.data as TwitterUser;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}

export async function postTweet(text: string, replyToTweetId?: string): Promise<string | null> {
  // Clear rate limit reset time if it has passed
  if (postTweetRateLimitResetTime && postTweetRateLimitResetTime <= new Date()) {
    postTweetRateLimitResetTime = null;
    console.log('✅ Post tweet rate limit reset time has passed, clearing cache');
  }
  
  // Check if we're still rate limited before making the API call
  if (postTweetRateLimitResetTime && postTweetRateLimitResetTime > new Date()) {
    const waitTime = postTweetRateLimitResetTime.getTime() - Date.now();
    const waitMinutes = Math.ceil(waitTime / 60000);
    console.warn(`⚠️ Still rate limited for posting tweets. Reset time: ${postTweetRateLimitResetTime.toISOString()}, Wait: ${waitMinutes} minutes`);
    return null;
  }
  
  try {
    // Check if Twitter API credentials are configured
    if (!process.env.TWITTER_API_KEY || !process.env.TWITTER_API_SECRET || 
        !process.env.TWITTER_ACCESS_TOKEN || !process.env.TWITTER_ACCESS_SECRET) {
      console.error('Twitter API credentials not configured. Missing:', {
        hasApiKey: !!process.env.TWITTER_API_KEY,
        hasApiSecret: !!process.env.TWITTER_API_SECRET,
        hasAccessToken: !!process.env.TWITTER_ACCESS_TOKEN,
        hasAccessSecret: !!process.env.TWITTER_ACCESS_SECRET
      });
      return null;
    }
    
    const { client } = getTwitterClient();
    
    if (!client) {
      console.error('Twitter client not initialized');
      return null;
    }
    
    const tweetOptions: any = { 
      text: text.substring(0, 280) // Ensure text is within Twitter's limit
    };
    
    if (replyToTweetId) {
      // Ensure tweet ID is a string (Twitter API v2 requires string IDs)
      const tweetId = String(replyToTweetId).trim();
      if (!tweetId || tweetId === 'undefined' || tweetId === 'null') {
        console.error('Invalid tweet ID for reply:', replyToTweetId);
        return null;
      }
      tweetOptions.reply = {
        in_reply_to_tweet_id: tweetId
      };
    }
    
    console.log('Posting tweet:', { 
      text: tweetOptions.text.substring(0, 50) + '...', 
      replyToTweetId, 
      hasReply: !!replyToTweetId,
      textLength: tweetOptions.text.length
    });
    
    // Use the authenticated client (not readOnly) for posting tweets
    const tweet = await client.v2.tweet(tweetOptions);
    
    if (tweet?.data?.id) {
      console.log('✅ Tweet posted successfully:', tweet.data.id);
      return String(tweet.data.id);
    } else {
      console.error('❌ Tweet posted but no ID returned:', JSON.stringify(tweet, null, 2));
      return null;
    }
  } catch (error: any) {
    const errorDetails = {
      message: error?.message,
      code: error?.code,
      statusCode: error?.code || error?.statusCode,
      data: error?.data,
      errors: error?.errors,
      stack: error?.stack?.split('\n').slice(0, 5).join('\n')
    };
    
    console.error('❌ Error posting tweet:', errorDetails);
    
    // Log full error details for debugging
    if (error?.data) {
      console.error('Twitter API error details:', JSON.stringify(error.data, null, 2));
    }
    
    if (error?.errors) {
      console.error('Twitter API errors:', JSON.stringify(error.errors, null, 2));
    }
    
    // Check for common error codes
    if (error?.code === 403 || error?.statusCode === 403) {
      console.error('❌ Twitter API: Forbidden - Check if your app has write permissions and access tokens are valid');
    } else if (error?.code === 401 || error?.statusCode === 401) {
      console.error('❌ Twitter API: Unauthorized - Check if your access tokens are valid');
    } else if (error?.code === 429 || error?.statusCode === 429) {
      // Handle rate limiting for posting tweets
      // Try to extract reset time from various possible locations in the error object
      let resetTime: Date | null = null;
      
      // Debug: Log error structure to help identify where reset time might be
      console.log('🔍 Debugging 429 error structure:', {
        hasRateLimit: !!error?.rateLimit,
        rateLimit: error?.rateLimit,
        hasHeaders: !!error?.headers,
        headers: error?.headers,
        hasResponse: !!error?.response,
        responseHeaders: error?.response?.headers
      });
      
      // Priority 1: Check user 24-hour limit (most restrictive for posting tweets)
      // If user limit is exhausted, use that reset time
      if (error?.rateLimit?.userDay?.remaining === 0 && error?.rateLimit?.userDay?.reset) {
        resetTime = new Date(error.rateLimit.userDay.reset * 1000);
        console.log('📊 Using user 24-hour limit reset time (most restrictive)');
      }
      // Priority 2: Check app 24-hour limit
      else if (error?.rateLimit?.day?.remaining === 0 && error?.rateLimit?.day?.reset) {
        resetTime = new Date(error.rateLimit.day.reset * 1000);
        console.log('📊 Using app 24-hour limit reset time');
      }
      // Priority 3: Check 15-minute window reset (error.rateLimit.reset)
      else if (error?.rateLimit?.reset) {
        resetTime = new Date(error.rateLimit.reset * 1000);
        console.log('📊 Using 15-minute window reset time');
      }
      // Priority 4: Check error.headers for x-rate-limit-reset (Twitter API v2 standard header)
      else if (error?.headers?.['x-rate-limit-reset']) {
        const resetTimestamp = parseInt(error.headers['x-rate-limit-reset']);
        if (!isNaN(resetTimestamp)) {
          resetTime = new Date(resetTimestamp * 1000);
          console.log('📊 Using x-rate-limit-reset header');
        }
      }
      // Priority 5: Check error.response?.headers (alternative location)
      else if (error?.response?.headers?.['x-rate-limit-reset']) {
        const resetTimestamp = parseInt(error.response.headers['x-rate-limit-reset']);
        if (!isNaN(resetTimestamp)) {
          resetTime = new Date(resetTimestamp * 1000);
          console.log('📊 Using response headers x-rate-limit-reset');
        }
      }
      
      // Store the reset time to prevent future calls until it resets
      if (resetTime && resetTime > new Date()) {
        postTweetRateLimitResetTime = resetTime;
        const waitTime = Math.max(0, resetTime.getTime() - Date.now());
        console.error('❌ Twitter API: Rate limit exceeded for posting tweets', {
          resetTime: resetTime.toISOString(),
          waitTimeMs: waitTime,
          waitTimeMinutes: Math.ceil(waitTime / 60000),
          storedResetTime: postTweetRateLimitResetTime.toISOString()
        });
      } else {
        // Default to 15 minutes if no reset time provided (Twitter API v2 typically resets every 15 minutes)
        postTweetRateLimitResetTime = new Date(Date.now() + 900000);
        console.error('❌ Twitter API: Rate limit exceeded for posting tweets (no reset time), waiting 15 minutes', {
          storedResetTime: postTweetRateLimitResetTime.toISOString()
        });
      }
    }
    
    // Also log to a file or external service in production
    // For now, we'll make sure errors are visible in console
    console.error('Full error object:', JSON.stringify(errorDetails, null, 2));
    
    return null;
  }
}

export async function searchMentions(query: string, sinceId?: string): Promise<any[]> {
  // Clear rate limit reset time if it has passed
  if (rateLimitResetTime && rateLimitResetTime <= new Date()) {
    rateLimitResetTime = null;
    console.log('✅ Rate limit reset time has passed, clearing cache');
  }
  
  // Check if we're still rate limited before making the API call
  if (rateLimitResetTime && rateLimitResetTime > new Date()) {
    const waitTime = rateLimitResetTime.getTime() - Date.now();
    const waitMinutes = Math.ceil(waitTime / 60000);
    console.warn(`⚠️ Still rate limited. Reset time: ${rateLimitResetTime.toISOString()}, Wait: ${waitMinutes} minutes`);
    // Throw an error so the caller knows it's rate limited, not just "no tweets found"
    const error: any = new Error('Rate limit exceeded');
    error.code = 429;
    error.statusCode = 429;
    error.rateLimit = {
      reset: Math.floor(rateLimitResetTime.getTime() / 1000)
    };
    throw error;
  }
  
  try {
    const { bearerClient } = getTwitterClient();
    const res: any = await bearerClient.v2.search(query, {
      'tweet.fields': ['id', 'text', 'author_id', 'created_at', 'public_metrics'],
      'user.fields': ['id', 'username', 'name'],
      expansions: ['author_id'],
      max_results: 10, // Reduced from 50 to avoid rate limits
      since_id: sinceId,
    });
    // twitter-api-v2 returns paginator with data and includes; merge author info
    let tweets: any[] = [];
    if (Array.isArray(res?.data)) {
      tweets = res.data;
    } else if (Array.isArray(res?.data?.data)) {
      tweets = res.data.data;
    } else if (Array.isArray(res?.tweets)) {
      tweets = res.tweets;
    }
    
    // Attach author info from includes
    if (tweets.length && res?.includes?.users) {
      const userMap: Record<string, any> = {};
      for (const u of res.includes.users) {
        userMap[u.id] = u;
      }
      for (const t of tweets) {
        if (t.author_id && userMap[t.author_id]) {
          t.author = userMap[t.author_id];
          t.username = userMap[t.author_id].username;
        }
        // Ensure tweet ID is always a string (Twitter API v2 requires string IDs)
        if (t.id) {
          t.id = String(t.id);
        }
      }
    }
    
    // Also normalize IDs for tweets that don't have author info attached
    for (const t of tweets) {
      if (t.id && typeof t.id !== 'string') {
        t.id = String(t.id);
      }
    }
    
    return tweets;
  } catch (error: any) {
    // Handle rate limiting specifically
    if (error?.code === 429 || error?.statusCode === 429) {
      const rateLimit = error?.rateLimit;
      const resetTime = rateLimit?.reset ? new Date(rateLimit.reset * 1000) : null;
      
      // Store the reset time to prevent future calls until it resets
      if (resetTime) {
        rateLimitResetTime = resetTime;
        const waitTime = Math.max(0, resetTime.getTime() - Date.now());
        console.error('❌ Twitter API: Rate limit exceeded for search mentions', {
          resetTime: resetTime.toISOString(),
          waitTimeMs: waitTime,
          waitTimeMinutes: Math.ceil(waitTime / 60000),
          storedResetTime: rateLimitResetTime.toISOString()
        });
      } else {
        // Default to 15 minutes if no reset time provided
        rateLimitResetTime = new Date(Date.now() + 900000);
        console.error('❌ Twitter API: Rate limit exceeded (no reset time), waiting 15 minutes');
      }
      
      // Return empty array to prevent further processing
      return [];
    }
    
    console.error('Error searching mentions:', {
      message: error?.message,
      code: error?.code,
      statusCode: error?.statusCode,
      rateLimit: error?.rateLimit
    });
    return [];
  }
}


