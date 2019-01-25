# shed.ot

shed is a self-hosted shared editor + code runner

## Demo

To see a demo, please visit https://code.algorithm.city

## Development

```
docker build -t shed/runner .
npm install
npm start
```

If you change assets, be sure to run `make` and restart the server.

## Credits

based on https://github.com/YingshanDeng/ot.js-demo, shed uses ot.js,
codemirror and docker to run code.

## License

MIT
