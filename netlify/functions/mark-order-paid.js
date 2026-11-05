exports.handler = async function (event) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        success: false,
        message: "只允许 POST 请求"
      })
    };
  }

  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error("服务器环境变量未配置");
    }

    const body = JSON.parse(event.body || "{}");

    const order_no = String(body.order_no || "").trim();
    const payment_method = String(body.payment_method || "").trim();

    if (!order_no) {
      throw new Error("订单编号不能为空");
    }

    if (!["微信支付", "支付宝"].includes(payment_method)) {
      throw new Error("不支持的支付方式");
    }

    const response = await fetch(
      SUPABASE_URL + "/rest/v1/rpc/mark_order_paid",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_KEY,
          "Authorization": "Bearer " + SUPABASE_KEY
        },
        body: JSON.stringify({
          p_order_no: order_no,
          p_payment_method: payment_method
        })
      }
    );

    const responseText = await response.text();

    let data;

    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error("数据库返回内容无法识别");
    }

    if (!response.ok) {
      throw new Error(
        data.message ||
        data.details ||
        data.hint ||
        "付款申请提交失败"
      );
    }

    if (data !== true) {
      throw new Error("数据库未确认付款申请");
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: true
      })
    };

  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        message: error.message || "付款申请失败"
      })
    };
  }
};
