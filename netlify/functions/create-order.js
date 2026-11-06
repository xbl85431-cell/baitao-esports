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
    const PUSHPLUS_TOKEN = process.env.PUSHPLUS_TOKEN;

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

    if (!nickname || !game_id) {
      throw new Error("请填写老板称呼和游戏 ID");
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 5) {
      throw new Error("预约数量不正确");
    }

    if (!["娱乐陪玩", "技术陪玩", "护航服务"].includes(service)) {
      throw new Error("服务类型不正确");
    }

    if (service === "护航服务" && quantity !== 1) {
      throw new Error("护航服务一次只能预约一单");
    }

    // 第一步：创建数据库订单

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

    // 第二步：数据库创建成功后，发送微信通知

    if (PUSHPLUS_TOKEN) {
      try {
        const message = [
          "白桃电竞收到一笔新订单！",
          "",
          "老板称呼：" + nickname,
          "游戏 ID：" + game_id,
          "订单编号：" + result.order_no,
          "服务项目：" + service,
          "预约数量：" + quantity,
          "订单金额：¥" + result.amount,
          "预约时间：" + (timing || "未填写"),
          "备注：" + (note || "无"),
          "",
          "请及时登录后台查看订单。"
        ].join("\n");

        const controller = new AbortController();

        const timeout = setTimeout(() => {
          controller.abort();
        }, 5000);

        try {
          const pushResponse = await fetch(
            "https://www.pushplus.plus/send",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                token: PUSHPLUS_TOKEN,
                title: "白桃电竞｜新订单提醒",
                content: message,
                template: "txt",
                channel: "wechat"
              }),
              signal: controller.signal
            }
          );

          const pushResult = await pushResponse.json().catch(() => null);

          if (
            !pushResponse.ok ||
            (pushResult && Number(pushResult.code) !== 200)
          ) {
            console.warn(
              "PushPlus通知发送失败，HTTP状态：",
              pushResponse.status
            );
          }

        } finally {
          clearTimeout(timeout);
        }

      } catch (pushError) {
        console.warn(
          "PushPlus通知异常，订单已成功创建：",
          pushError.message
        );
      }
    } else {
      console.warn("未配置PUSHPLUS_TOKEN，跳过微信通知");
    }

    // 第三步：正常返回订单信息

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
