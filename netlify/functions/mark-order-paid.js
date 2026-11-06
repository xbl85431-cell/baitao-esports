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

    // 第二步：付款申请成功后查询订单详情

    if (PUSHPLUS_TOKEN) {
      try {
        const params = new URLSearchParams({
          select: "order_no,nickname,game_id,service,quantity,timing,note,amount",
          order_no: "eq." + order_no,
          limit: "1"
        });

        const orderResponse = await fetch(
          SUPABASE_URL + "/rest/v1/orders?" + params.toString(),
          {
            method: "GET",
            headers: {
              "apikey": SUPABASE_KEY,
              "Authorization": "Bearer " + SUPABASE_KEY
            }
          }
        );

        if (!orderResponse.ok) {
          throw new Error("无法读取订单详情，数据库可能限制了查询权限");
        }

        const orders = await orderResponse.json();
        const order = Array.isArray(orders) ? orders[0] : null;

        if (!order) {
          throw new Error("没有找到对应的订单");
        }

        // 第三步：发送原来的微信通知，内容完全不变

        const message = [
          "白桃电竞收到一笔新订单！",
          "",
          "老板称呼：" + order.nickname,
          "游戏 ID：" + order.game_id,
          "订单编号：" + order.order_no,
          "服务项目：" + order.service,
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
          "微信通知发送异常，付款申请已经成功：",
          pushError.message
        );
      }
    } else {
      console.warn("未配置PUSHPLUS_TOKEN，跳过微信通知");
    }

    // 第四步：正常返回付款申请结果

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
