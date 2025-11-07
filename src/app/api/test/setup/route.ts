import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { testMongoDBConnection } from '@/lib/test-mongodb';

export async function GET() {
  try {
    const results = {
      privy: {
        appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID ? '✅ Set' : '❌ Missing',
        secret: process.env.PRIVY_APP_SECRET ? '✅ Set' : '❌ Missing'
      },
      mongodb: {
        uri: process.env.MONGODB_URI ? '✅ Set' : '❌ Missing',
        connection: 'Testing...'
      },
      bsc: {
        rpc: process.env.NEXT_PUBLIC_BSC_RPC_URL ? '✅ Set' : '❌ Missing',
        serverRpc: process.env.BSC_RPC_URL ? '✅ Set' : '❌ Missing'
      },
      encryption: {
        key: process.env.ENCRYPTION_KEY ? '✅ Set' : '❌ Missing'
      }
    };

    // Test MongoDB connection
    if (process.env.MONGODB_URI) {
      try {
        await connectDB();
        results.mongodb.connection = '✅ Connected';
      } catch (error) {
        results.mongodb.connection = `❌ Failed: ${error}`;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Environment setup check',
      results
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Setup check failed',
      details: error
    }, { status: 500 });
  }
}

