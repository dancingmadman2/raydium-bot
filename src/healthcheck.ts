import http from 'http';

const server = http.createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200);
    res.end('Bot is running');
  } else {
    res.writeHead(404);
    res.end();
  }
});


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Healthcheck server listening on port ${PORT}`);
});

export default server; 