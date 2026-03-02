import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const correlationId = crypto.randomUUID();
  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const body = await req.json();
    const { method, api_key, data } = body;

    // Validate method
    if (method !== "simple_check_wallet_registration") {
      return new Response(
        JSON.stringify({ success: false, error: `Unknown method: ${method}. Supported: simple_check_wallet_registration`, correlation_id: correlationId }),
        { status: 400, headers }
      );
    }

    // Validate required fields
    if (!api_key) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing api_key", correlation_id: correlationId }),
        { status: 400, headers }
      );
    }

    if (!data?.wallet_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing data.wallet_id", correlation_id: correlationId }),
        { status: 400, headers }
      );
    }

    const walletId = data.wallet_id;

    // Validate wallet format
    if (!/^L[a-zA-Z0-9]{25,34}$/.test(walletId)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid wallet address format. Must start with 'L' and be 26-35 characters.", correlation_id: correlationId }),
        { status: 400, headers }
      );
    }

    // Init Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate API key
    const { data: apiKeyRecord, error: apiKeyError } = await supabase
      .from("api_keys")
      .select("id, is_active, rate_limit_per_hour, request_count_current_hour, last_request_at")
      .eq("api_key", api_key)
      .maybeSingle();

    if (apiKeyError || !apiKeyRecord || !apiKeyRecord.is_active) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or inactive API key", correlation_id: correlationId }),
        { status: 401, headers }
      );
    }

    // Rate limiting
    const now = new Date();
    const lastRequest = apiKeyRecord.last_request_at ? new Date(apiKeyRecord.last_request_at) : null;
    const sameHour = lastRequest && lastRequest.getUTCHours() === now.getUTCHours() && lastRequest.getUTCDate() === now.getUTCDate();

    const currentCount = sameHour ? apiKeyRecord.request_count_current_hour : 0;
    if (currentCount >= apiKeyRecord.rate_limit_per_hour) {
      return new Response(
        JSON.stringify({ success: false, error: "Rate limit exceeded", correlation_id: correlationId }),
        { status: 429, headers }
      );
    }

    // Update request count
    await supabase
      .from("api_keys")
      .update({
        last_request_at: now.toISOString(),
        request_count_current_hour: currentCount + 1,
      })
      .eq("id", apiKeyRecord.id);

    // Query wallets table
    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("wallet_id, wallet_type, main_wallet_id, created_at")
      .eq("wallet_id", walletId)
      .maybeSingle();

    if (walletError) {
      console.error(`[${correlationId}] DB error:`, walletError);
      return new Response(
        JSON.stringify({ success: false, error: "Database query failed", correlation_id: correlationId }),
        { status: 500, headers }
      );
    }

    if (wallet) {
      return new Response(
        JSON.stringify({
          success: true,
          registered: true,
          wallet: {
            wallet_id: wallet.wallet_id,
            wallet_type: wallet.wallet_type,
            main_wallet_id: wallet.main_wallet_id,
            created_at: wallet.created_at,
          },
          correlation_id: correlationId,
        }),
        { status: 200, headers }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        registered: false,
        wallet_id: walletId,
        correlation_id: correlationId,
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error(`[${correlationId}] Unexpected error:`, error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unexpected error",
        correlation_id: correlationId,
      }),
      { status: 500, headers }
    );
  }
});
