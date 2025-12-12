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

// KILL SWITCH - set to false to disable API
const API_ENABLED = false;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // API temporarily disabled
  if (!API_ENABLED) {
    return new Response(
      JSON.stringify({ error: "Serwis tymczasowo niedostępny. Wróć za tydzień! 🚧" }),
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

    // Build system prompt - casual, natural, only responds when asked
    const baseSystemPrompt = `You are a casual, friendly tutor helping someone learn about AI image generation.

CRITICAL RULES:
- ONLY speak when the user asks you something or says hello
- DO NOT give long monologues or lectures
- Keep responses to 1-2 SHORT sentences max
- Be natural and relaxed, like chatting with a friend
- Use simple everyday language
- If you don't understand what they said, just ask them to repeat
- NO formal greetings like "Welcome!" or "Let's begin!"
- Just be chill and helpful`;

    const slideSpecificPrompt = slideContext 
      ? `

You're currently on the slide about "${slideContext.title}".
If asked, you can explain: ${slideContext.keyPoints.join(', ')}

Remember: WAIT for questions. Don't lecture. Just answer what they ask.`
      : '';

    const fullSystemPrompt = baseSystemPrompt + slideSpecificPrompt;

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
