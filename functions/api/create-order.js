function jsonResponse(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}

export async function onRequest(context) {
  const request = context.request;
  const env = context.env || {};

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(405, {
      success: false,
      message: "只允许 POST 请求"
    });
  }

  const urlExists = Boolean(env.SUPABASE_URL);
  const publishableExists = Boolean(env.SUPABASE_PUBLISHABLE_KEY);
  const secretExists = Boolean(env.SUPABASE_SECRET_KEY);
  const pushplusExists = Boolean(env.PUSHPLUS_TOKEN);

  if (!urlExists || !publishableExists) {
    return jsonResponse(500, {
      success: false,
      message: "Cloudflare Functions 环境变量读取检查失败",
      debug: {
        SUPABASE_URL: urlExists,
        SUPABASE_PUBLISHABLE_KEY: publishableExists,
        SUPABASE_SECRET_KEY: secretExists,
        PUSHPLUS_TOKEN: pushplusExists,
        available_variable_names: Object.keys(env)
      }
    });
  }

  return jsonResponse(200, {
    success: true,
    message: "Cloudflare Functions 已成功读取 Supabase 环境变量",
    debug: {
      SUPABASE_URL: true,
      SUPABASE_PUBLISHABLE_KEY: true,
      SUPABASE_SECRET_KEY: secretExists,
      PUSHPLUS_TOKEN: pushplusExists
    }
  });
}
