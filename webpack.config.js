const path = require('path');
const webpack = require('webpack');
const dotenv = require('dotenv');

// 加载 .env 文件中的环境变量
const env = dotenv.config().parsed;
// 将 .env 文件中的环境变量转换为 DefinePlugin 插件可以使用的格式
const envKeys = Object.keys(env).reduce((prev, next) => {
  prev[`process.env.${next}`] = JSON.stringify(env[next]);
  return prev;
}, {});

module.exports = {
    entry: './app.js',
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist')
    },
    target: 'node',
    mode: 'production',
    plugins: [
      // 使用 DefinePlugin 插件来定义环境变量
      new webpack.DefinePlugin(envKeys)
    ]
};
