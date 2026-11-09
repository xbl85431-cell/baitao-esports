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

  return jsonResponse(200, {
    success: urlExists && publishableExists,
    message: "环境变量检查结果：" + JSON.stringify({
      SUPABASE_URL: urlExists,
      SUPABASE_PUBLISHABLE_KEY: publishableExists,
      SUPABASE_SECRET_KEY: secretExists,
      PUSHPLUS_TOKEN: pushplusExists,
      available_variable_names: Object.keys(env)
    })
  });
}
