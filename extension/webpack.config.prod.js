const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
    mode: 'production', // Pour avoir des logs détaillés
    devtool: 'cheap-module-source-map', // Pour un meilleur debugging
    entry: {
        background: './src/background/background.ts',
        popup: './src/popup/popup.ts',
        content: './src/content/content.ts'
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].js',
        clean: true // Nettoie le dossier dist avant chaque build
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/
            }
        ]
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js']
    },
    plugins: [
        new CopyPlugin({
            patterns: [
                {
                    from: "manifest_prod.json",
                    to: "manifest.json"
                },
                {
                    from: "src/popup/popup.html",
                    to: "popup.html"
                },
                {
                    from: "public/icons",
                    to: "icons",
                    noErrorOnMissing: true
                }
            ]
        })
    ]
};