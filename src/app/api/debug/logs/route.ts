import { NextResponse } from 'next/server';

// This endpoint helps you see where to find logs in production
export async function GET() {
  const platform = process.env.VERCEL ? 'Vercel' : 
                   process.env.RAILWAY_ENVIRONMENT ? 'Railway' :
                   process.env.FLY_APP_NAME ? 'Fly.io' :
                   'Unknown';

  const logLocations = {
    Vercel: {
      dashboard: 'https://vercel.com/dashboard',
      logs: 'Go to your Vercel project → Deployments → Click on a deployment → Logs tab',
      cli: 'Run: vercel logs',
      api: 'Use Vercel API to fetch logs programmatically',
    },
    Railway: {
      dashboard: 'https://railway.app/dashboard',
      logs: 'Go to your Railway project → Click on service → View Logs',
      cli: 'Run: railway logs',
    },
    'Fly.io': {
      dashboard: 'https://fly.io/dashboard',
      logs: 'Run: fly logs',
      cli: 'Run: fly logs',
    },
    Unknown: {
      message: 'Check your deployment platform\'s documentation for log access',
    },
  };

  return NextResponse.json({
    platform,
    logLocations: logLocations[platform as keyof typeof logLocations],
    environment: {
      nodeEnv: process.env.NODE_ENV,
      vercel: !!process.env.VERCEL,
      vercelUrl: process.env.VERCEL_URL,
    },
    tips: [
      'Check your deployment platform\'s dashboard for logs',
      'Use the /api/debug/twitter-errors endpoint to see recent errors',
      'Check server console output if running on a VPS/server',
      'Use a logging service like Logtail, Datadog, or Sentry for better log management',
    ],
  });
}

