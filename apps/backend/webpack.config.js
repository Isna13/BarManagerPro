module.exports = function (options, webpack) {
  return {
    ...options,
    externals: {
      'bcrypt': 'commonjs2 bcrypt',
      '@mapbox/node-pre-gyp': 'commonjs2 @mapbox/node-pre-gyp',
    },
    output: {
      ...options.output,
      libraryTarget: 'commonjs2',
    },
    plugins: [
      ...options.plugins,
      new webpack.IgnorePlugin({
        checkResource(resource) {
          const lazyImports = [
            '@nestjs/microservices',
            '@nestjs/microservices/microservices-module',
            'cache-manager',
            'class-validator',
            'class-transformer',
          ];
          if (!lazyImports.includes(resource)) {
            return false;
          }
          try {
            require.resolve(resource);
          } catch (err) {
            return true;
          }
          return false;
        },
      }),
    ],
    stats: {
      errorDetails: true,
      warnings: false, // Ignorar warnings
    },
    optimization: {
      ...options.optimization,
      minimize: false,
    },
  };
};
