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

    if (!OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY is not configured');
      throw new Error('OPENAI_API_KEY is not configured');
    }

    console.log('Creating Anam session with slide context:', slideContext?.id);

    // Build system prompt with slide context - SIMPLE & SHORT responses!
    const baseSystemPrompt = `You are a friendly AI tutor teaching AI image generation.

IMPORTANT RULES:
- Speak BRIEFLY - max 2-3 sentences per response
- Use SIMPLE language, like explaining to a 5-year-old
- Be friendly and encouraging
- Give practical examples
- When the user changes slides, briefly welcome the new topic`;

    const slideSpecificPrompt = slideContext 
      ? `

CURRENT SLIDE: "${slideContext.title}"
KEY POINTS: ${slideContext.keyPoints.join(', ')}
CONTEXT: ${slideContext.systemPromptContext}

When the user reaches this slide, briefly (1 sentence) introduce the topic and ask if they have questions.`
      : '';

    const fullSystemPrompt = baseSystemPrompt + slideSpecificPrompt;

    // Use OpenAI as the brain/LLM provider
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
          systemPrompt: fullSystemPrompt,
          brainType: 'CUSTOM',
          customBrain: {
            provider: 'OPEN_AI',
            model: 'gpt-4o-mini',
            apiKey: OPENAI_API_KEY,
          },
        },
        disableInputAudio: true,
      }),
    });

    if (!anamResponse.ok) {
      const errorText = await anamResponse.text();
      console.error('Anam API error:', anamResponse.status, errorText);
      throw new Error(`Anam API error: ${anamResponse.status} - ${errorText}`);
    }

    const sessionData = await anamResponse.json();
    console.log('Anam session created successfully with OpenAI brain');

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
