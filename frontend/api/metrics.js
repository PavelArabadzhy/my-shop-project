// frontend/api/metrics.js

const TARGET_URL = "https://edge.stapesite.com";

module.exports = async (req, res) => {
    const forwardedFor = req.headers["x-forwarded-for"] || "";
    const clientIp = forwardedFor.split(",")[0].trim() || "unknown";

    const newHeaders = {
        ...req.headers,
        "X-Forwarded-For": clientIp,
        "X-From-Cdn": "cf-stape",
        "Host": "edge.stapesite.com",
        "CF-Connecting-Ip": clientIp,
    };

    const response = await fetch(TARGET_URL + req.url.replace(/^\/api\/metrics/, ""), {
        method: req.method,
        headers: newHeaders,
        body: req.method === "GET" || req.method === "HEAD" ? undefined : req,
    });

    for (const [key, value] of response.headers.entries()) {
        res.setHeader(key, value);
    }

    const text = await response.text();

    res.status(response.status).send(text);
};