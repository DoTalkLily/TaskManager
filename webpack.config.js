var webpack = require("webpack");

module.exports = {
    entry: './src/task_manager.js',
    output: {
        filename: './dest/task-manager.js'
    },
    resolve: {
        // you can now require('file') instead of require('file.coffee')
        extensions: ['', '.js']
    },
    plugins: [
        new webpack.optimize.UglifyJsPlugin({
            compress: {
                warnings: false
            }
        })
    ]
};