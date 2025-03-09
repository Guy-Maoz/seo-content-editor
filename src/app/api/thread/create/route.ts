import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST() {
  try {
    // Create a new thread
    const thread = await openai.beta.threads.create();
    
    console.log(`Created new thread: ${thread.id}`);
    
    return NextResponse.json({ 
      threadId: thread.id,
      success: true
    });
  } catch (error) {
    console.error('Error creating thread:', error);
    return NextResponse.json(
      { error: 'Failed to create thread', success: false },
      { status: 500 }
    );
  }
} 