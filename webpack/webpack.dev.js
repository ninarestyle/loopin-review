const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');
const webpack = require('webpack');
const dotenv = require('dotenv');

// Load environment variables from .env file, where API keys and passwords are configured.
dotenv.config({ path: './.env' });  // Specify the path to your .env file here

module.exports = merge(common, {
    devtool: 'inline-source-map',
    mode: 'development',
    plugins: [
        new webpack.DefinePlugin({
            'process.env.NEXT_PUBLIC_APP_URL': JSON.stringify(process.env.NEXT_PUBLIC_APP_URL),
            'process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID': JSON.stringify(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID),
        })
    ]
});
