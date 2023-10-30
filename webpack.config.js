const path = require('path');
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

const buildDir = __dirname + '/lib';

const localConfig = {
    js_filename: '[name].min.js'
};

module.exports = environment => {
    return {
        entry: {
            highlight: './src/resources/js/highlight'
        },
        output: {
            path: path.resolve(buildDir),
            filename: localConfig['js_filename']
        },
        mode: 'production',
        module: {
            rules: [
                {
                    test: /\.js$/,
                    use: {
                        loader: 'babel-loader',
                        options: {
                            presets: ['@babel/preset-env']
                        }
                    }
                }
            ]
        },
        optimization: {
            minimizer: [new TerserPlugin({
                extractComments: false,
            })],
        },
        plugins: [
            new CopyWebpackPlugin({
                patterns: [
                    {
                        from: path.resolve(__dirname + '/node_modules/pako/dist/pako_inflate.js'),
                        to: '[name].min[ext]'
                    }
                ]
            })
        ]
    }
};
