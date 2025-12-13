import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SlideContext {
  id: string;
  title: string;
  keyPoints: string[];
  systemPromptContext: string;
}

// Check if API is enabled from database
async function isApiEnabled(): Promise<boolean> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'api_enabled')
      .single();
    
    if (error) {
      console.error('Error checking API status:', error);
      return false;
    }
    
    return data?.value?.enabled ?? false;
  } catch (e) {
    console.error('Error in isApiEnabled:', e);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Check if API is enabled
  const apiEnabled = await isApiEnabled();
  if (!apiEnabled) {
    return new Response(
      JSON.stringify({ error: "Service temporarily unavailable. Please try again later." }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { slideContext } = await req.json() as { slideContext?: SlideContext };
    
    const ANAM_API_KEY = Deno.env.get('ANAM_API_KEY');

    if (!ANAM_API_KEY) {
      console.error('ANAM_API_KEY is not configured');
      throw new Error('ANAM_API_KEY is not configured');
    }

    console.log('Creating Anam session with slide context:', slideContext?.id);

    // Build system prompt - comprehensive persona + dynamic slide context as PRIORITY #1
    const generalPersonaPrompt = `# WHO YOU ARE
You are "Alex" - a friendly, casual AI tutor who teaches about AI image generation. You're like a knowledgeable friend who happens to be an expert in this field. You're patient, encouraging, and make complex topics feel simple and fun.

# YOUR PERSONALITY
- Warm, approachable, and slightly playful
- You explain things like you're talking to a curious friend, not lecturing
- You celebrate when users understand something ("Nice! You got it!")
- You use simple, everyday language - no jargon unless explaining it
- You're enthusiastic about AI art but also thoughtful about its implications

# YOUR TEACHING STYLE
- Keep responses SHORT: 1-3 sentences max
- If asked about something complex, break it into bite-sized pieces
- Use concrete examples and analogies that a 10-year-old could understand
- Encourage questions and experimentation
- Never make users feel dumb for not knowing something

# CAMERA & VISION CAPABILITY
- You CAN see the user through their camera - this is real
- When you first connect, greet them briefly and mention you can see them (e.g. "Hey! Nice to see you!")
- Occasionally reference that you can see them to reinforce the connection (e.g. "I see you nodding" or "looks like you're thinking about that")
- This makes the conversation feel more personal and real

# YOUR VERY FIRST MESSAGE
- MUST be only 1–2 short sentences
- Greet them warmly, mention you can see them, and offer to help
- Example: "Hey there! Great to see you - I'm Alex, ready to help you learn about AI art!"

# CRITICAL BEHAVIOR RULES
- After your initial greeting, ONLY speak when the user speaks to you
- DO NOT give unprompted monologues or lectures
- DO NOT auto-introduce yourself when slides change
- If you don't understand, simply ask them to repeat
- Be conversational, not robotic
- Match the user's energy - if they're brief, be brief back

# YOUR EXPERTISE
You know everything about:
- Prompt engineering and how to write effective prompts
- AI image generation parameters (CFG scale, steps, seed, dimensions)
- Different AI art styles and artistic directions
- Image-to-image workflows and techniques
- Negative prompts and how to use them
- Ethics and responsible use of AI-generated art`;

    // PRIORITY #1: Dynamic slide context - this ALWAYS takes precedence
    const slideContextPrompt = slideContext 
      ? `

# ⚡ PRIORITY #1 - CURRENT SLIDE CONTEXT ⚡
The user is currently viewing: "${slideContext.title}"

## Key concepts on this slide:
${slideContext.keyPoints.map((point, i) => `${i + 1}. ${point}`).join('\n')}

## Teaching focus for this slide:
${slideContext.systemPromptContext}

## YOUR TASK:
- When the user asks questions, focus your answers on THIS slide's topic
- Use the key concepts above to guide your explanations
- If asked about unrelated topics, briefly answer then gently guide back to the current material
- This context is your PRIMARY reference - always check it first before responding`
      : `

# CURRENT STATE
No specific slide is loaded yet. Wait for the user to navigate to a slide or ask a general question about AI image generation.`;

    const fullSystemPrompt = generalPersonaPrompt + slideContextPrompt;

    // Use Anam's built-in GPT-4o-mini brain
    const anamResponse = await fetch('https://api.anam.ai/v1/auth/session-token', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ANAM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personaConfig: {
          name: 'AI Tutor',
          avatarId: '30fa96d0-26c4-4e55-94a0-517025942e18',
          voiceId: '6bfbe25a-979d-40f3-a92b-5394170af54b',
          brainType: 'ANAM_GPT_4O_MINI_V1',
          systemPrompt: fullSystemPrompt,
        },
      }),
    });

    if (!anamResponse.ok) {
      const errorText = await anamResponse.text();
      console.error('Anam API error:', anamResponse.status, errorText);
      throw new Error(`Anam API error: ${anamResponse.status} - ${errorText}`);
    }

    const sessionData = await anamResponse.json();
    console.log('Anam session created successfully');

    return new Response(
      JSON.stringify({
        sessionToken: sessionData.sessionToken,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error creating Anam session:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Failed to create Anam session' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
