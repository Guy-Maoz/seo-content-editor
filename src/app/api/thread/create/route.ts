import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST() {
  console.log('[API] /api/thread/create: Endpoint called');
  
  try {
    console.log('[API] Attempting to create thread with OpenAI');
    // Create a new thread
    const thread = await openai.beta.threads.create();
    
    console.log(`[API] Created new thread: ${thread.id}`);
    
    return NextResponse.json({ 
      threadId: thread.id,
      success: true
    });
  } catch (error) {
    console.error('[API] Error creating thread:', error);
    return NextResponse.json(
      { error: 'Failed to create thread', success: false },
      { status: 500 }
    );
  }
} 