import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { slideContext } = await req.json() as { slideContext?: SlideContext };
    
    const ANAM_API_KEY = Deno.env.get('ANAM_API_KEY');
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

    if (!ANAM_API_KEY) {
      console.error('ANAM_API_KEY is not configured');
      throw new Error('ANAM_API_KEY is not configured');
    }

    console.log('Creating Anam session with slide context:', slideContext?.id);

    // Build system prompt with slide context
    const baseSystemPrompt = `You are an expert AI tutor teaching a course on AI Image Generation. You are friendly, encouraging, and explain complex concepts in simple terms.

Your role is to:
1. Help the student understand the current slide content
2. Answer their questions clearly and concisely
3. Provide practical examples when helpful
4. Encourage them to try things in the AI Playground
5. Keep responses conversational and not too long

Important guidelines:
- Be conversational, not lecture-like
- Use analogies to explain technical concepts
- If they ask about something not on the current slide, briefly answer but guide them back to the topic
- Celebrate their progress and curiosity`;

    const slideSpecificPrompt = slideContext 
      ? `

CURRENT SLIDE: "${slideContext.title}"
KEY POINTS TO COVER: ${slideContext.keyPoints.join(', ')}
TEACHING CONTEXT: ${slideContext.systemPromptContext}

Start by briefly welcoming the student to this topic and asking what aspect interests them most.`
      : '';

    const fullSystemPrompt = baseSystemPrompt + slideSpecificPrompt;

    // Create session with Anam API
    const anamResponse = await fetch('https://api.anam.ai/v1/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ANAM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        persona: {
          name: 'AI Tutor',
          description: 'A friendly AI image generation tutor',
          systemPrompt: fullSystemPrompt,
          voice: {
            provider: 'elevenlabs',
            voiceId: 'pNInz6obpgDQGcFmaJgB', // Adam - friendly male voice
          },
          avatar: {
            type: 'realistic',
            avatarId: 'anna_public', // Or another available avatar
          },
          llm: OPENAI_API_KEY ? {
            provider: 'custom',
            model: 'gpt-4o',
            apiKey: OPENAI_API_KEY,
            baseUrl: 'https://api.openai.com/v1',
          } : undefined,
        },
        tools: [
          {
            name: 'getCurrentSlide',
            description: 'Get information about the current slide the user is viewing',
            parameters: {
              type: 'object',
              properties: {},
              required: [],
            },
          },
          {
            name: 'onSlideChange',
            description: 'Called when user navigates to a different slide',
            parameters: {
              type: 'object',
              properties: {
                slideId: { type: 'string', description: 'The ID of the new slide' },
                slideTitle: { type: 'string', description: 'The title of the new slide' },
              },
              required: ['slideId', 'slideTitle'],
            },
          },
        ],
      }),
    });

    if (!anamResponse.ok) {
      const errorText = await anamResponse.text();
      console.error('Anam API error:', anamResponse.status, errorText);
      throw new Error(`Anam API error: ${anamResponse.status} - ${errorText}`);
    }

    const sessionData = await anamResponse.json();
    console.log('Anam session created successfully:', sessionData.sessionId);

    return new Response(
      JSON.stringify({
        sessionToken: sessionData.sessionToken,
        sessionId: sessionData.sessionId,
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
