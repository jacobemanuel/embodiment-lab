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
5. Keep responses conversational and not too long`;

    const slideSpecificPrompt = slideContext 
      ? `\n\nCURRENT SLIDE: "${slideContext.title}"\nKEY POINTS: ${slideContext.keyPoints.join(', ')}\nCONTEXT: ${slideContext.systemPromptContext}`
      : '';

    const fullSystemPrompt = baseSystemPrompt + slideSpecificPrompt;

    // Correct endpoint: https://api.anam.ai/v1/auth/session-token
    const anamResponse = await fetch('https://api.anam.ai/v1/auth/session-token', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ANAM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personaConfig: {
          name: 'AI Tutor',
          // Default public avatars from Anam
          avatarId: '30fa96d0-26c4-4e55-94a0-517025942e18', // Default avatar
          voiceId: '6bfbe25a-979d-40f3-a92b-5394170af54b',  // Default voice
          llmId: '0934d97d-0c3a-4f33-91b0-5e136a0ef466',    // Default LLM
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
