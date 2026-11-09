function jsonResponse(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}

export async function onRequest(context) {
  const request = context.request;
  const env = context.env;

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

  try {
    const SUPABASE_URL = env.SUPABASE_URL;
    const SUPABASE_KEY = env.SUPABASE_PUBLISHABLE_KEY;
    const SUPABASE_SECRET_KEY = env.SUPABASE_SECRET_KEY;
    const PUSHPLUS_TOKEN = env.PUSHPLUS_TOKEN;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error("服务器环境变量未配置");
    }

    const body = await request.json();

    const order_no = String(body.order_no || "").trim();
    const payment_method = String(body.payment_method || "").trim();

    if (!order_no) {
      throw new Error("订单编号不能为空");
    }

    if (!["微信支付", "支付宝"].includes(payment_method)) {
      throw new Error("不支持的支付方式");
    }

    // 第一步：提交付款申请

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

    // 第二步：查询订单详情

    if (PUSHPLUS_TOKEN) {
      try {
        if (!SUPABASE_SECRET_KEY) {
          throw new Error("未配置SUPABASE_SECRET_KEY");
        }

        const params = new URLSearchParams({
          select: "order_no,nickname,game_id,service,quantity,companion_count,timing,note,amount",
          order_no: "eq." + order_no,
          limit: "1"
        });

        const orderResponse = await fetch(
          SUPABASE_URL + "/rest/v1/orders?" + params.toString(),
          {
            method: "GET",
            headers: {
              "apikey": SUPABASE_SECRET_KEY
            }
          }
        );

        const orderText = await orderResponse.text();

        if (!orderResponse.ok) {
          throw new Error("订单查询失败：" + orderText);
        }

        const orders = JSON.parse(orderText);
        const order = Array.isArray(orders) ? orders[0] : null;

        if (!order) {
          throw new Error("没有找到对应的订单");
        }

        // 判断陪玩人数

        const companionCount = Number(order.companion_count || 1);

        let companionText;

        if (String(order.service).includes("护航")) {
          companionText = "护航服务（固定1人）";
        } else if (companionCount === 2) {
          companionText = "双陪（2人）";
        } else {
          companionText = "单陪（1人）";
        }

        // 第三步：发送微信通知

        const message = [
          "白桃电竞收到一笔新订单！",
          "",
          "老板称呼：" + order.nickname,
          "游戏 ID：" + order.game_id,
          "订单编号：" + order.order_no,
          "服务项目：" + order.service,
          "陪玩人数：" + companionText,
          "预约数量：" + order.quantity,
          "订单金额：¥" + order.amount,
          "预约时间：" + (order.timing || "未填写"),
          "备注：" + (order.note || "无"),
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
            console.warn("PushPlus通知发送失败：", pushResult);
          }

        } finally {
          clearTimeout(timeout);
        }

      } catch (pushError) {
        console.warn(
          "微信通知发送异常，付款申请已经成功：",
          pushError.message
        );
      }
    }

    return jsonResponse(200, {
      success: true,
      data: true
    });

  } catch (error) {
    return jsonResponse(400, {
      success: false,
      message: error.message || "付款申请失败"
    });
  }
}
