const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');
const webpack = require('webpack');
const dotenv = require('dotenv');

// Load environment variables from .env.production file.
dotenv.config({ path: './.env.production' });

module.exports = merge(common, {
    mode: 'production',
    plugins: [
        new webpack.DefinePlugin({
            'process.env.NEXT_PUBLIC_APP_URL': JSON.stringify(process.env.NEXT_PUBLIC_APP_URL),
            'process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID': JSON.stringify(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID),
        })
    ]
});
