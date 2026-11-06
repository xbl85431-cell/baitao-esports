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

    const nickname = String(body.nickname || "").trim();
    const game_id = String(body.game_id || "").trim();
    const service = String(body.service || "").trim();
    const quantity = Number(body.quantity);
    const timing = String(body.timing || "").trim();
    const note = String(body.note || "").trim();

    // 兼容旧版网页：没有传人数时，默认单陪
    const companion_count =
      body.companion_count === undefined
        ? 1
        : Number(body.companion_count);

    if (!nickname || !game_id) {
      throw new Error("请填写老板称呼和游戏 ID");
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 5) {
      throw new Error("预约数量不正确");
    }

    if (!["娱乐陪玩", "技术陪玩", "护航服务"].includes(service)) {
      throw new Error("服务类型不正确");
    }

    if (![1, 2].includes(companion_count)) {
      throw new Error("陪玩人数不正确");
    }

    if (service === "护航服务") {
      if (quantity !== 1) {
        throw new Error("护航服务一次只能预约一单");
      }

      if (companion_count !== 1) {
        throw new Error("护航服务不区分单双陪");
      }
    }

    const response = await fetch(
      SUPABASE_URL + "/rest/v1/rpc/create_public_order",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_KEY,
          "Authorization": "Bearer " + SUPABASE_KEY
        },
        body: JSON.stringify({
          p_nickname: nickname,
          p_game_id: game_id,
          p_service: service,
          p_quantity: quantity,
          p_companion_count: companion_count,
          p_timing: timing,
          p_note: note
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
        "数据库创建订单失败"
      );
    }

    const result = Array.isArray(data) ? data[0] : data;

    if (!result || !result.order_no) {
      throw new Error("数据库没有返回订单编号");
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: result
      })
    };

  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        message: error.message || "创建订单失败"
      })
    };
  }
};
