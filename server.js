const http = require("http"), fs = require("fs"), path = require("path");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || process.env.SERVER_PORT || 3000;
const FILE = path.join(__dirname, "messages.json");

let msgs = [];
try { msgs = JSON.parse(fs.readFileSync(FILE, "utf8")); } catch (e) {}
let timer = null;
function save() {
  clearTimeout(timer);
  timer = setTimeout(() => fs.writeFile(FILE, JSON.stringify(msgs), () => {}), 1000);
}

const server = http.createServer((req, res) => {
  if (req.url === "/" || req.url.startsWith("/?")) {
    fs.readFile(path.join(__dirname, "public", "index.html"), (err, data) => {
      if (err) { res.writeHead(500); return res.end("error"); }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(data);
    });
  } else {
    res.writeHead(404); res.end("not found");
  }
});

const wss = new WebSocketServer({ server });
function broadcast(obj) {
  const s = JSON.stringify(obj);
  wss.clients.forEach(c => { if (c.readyState === 1) c.send(s); });
}
function count() { broadcast({ type: "count", n: wss.clients.size }); }

wss.on("connection", ws => {
  ws.times = [];
  ws.send(JSON.stringify({ type: "history", msgs }));
  count();
  ws.on("message", raw => {
    let d; try { d = JSON.parse(raw); } catch (e) { return; }
    const name = String(d.name || "").trim().slice(0, 24);
    const text = String(d.text || "").trim().slice(0, 500);
    if (!name || !text) return;
    const now = Date.now();
    ws.times = ws.times.filter(t => now - t < 5000);
    if (ws.times.length >= 8) return; // simple spam limit
    ws.times.push(now);
    const m = { name, text, cid: String(d.cid || "").slice(0, 40), ts: now };
    msgs.push(m);
    if (msgs.length > 200) msgs.shift();
    save();
    broadcast({ type: "msg", m });
  });
  ws.on("close", count);
});

server.listen(PORT, "0.0.0.0", () => console.log("Running on port " + PORT));
