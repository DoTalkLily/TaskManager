module.exports = {
    entry: './src/task_manager.js',
    output: {
        filename: './dest/bundle.js'
    },
    resolve: {
        // you can now require('file') instead of require('file.coffee')
        extensions: ['', '.js']
    }
};