'use strict';

module.exports = function routes($allonsy, $gulp) {

  var fs = require('fs-extra'),
      path = require('path'),
      sourcemaps = require('gulp-sourcemaps'),
      uglify = require('gulp-uglify'),
      rename = require('gulp-rename'),
      extend = require('extend'),
      filesPattern = '*-route.js';

  $gulp.task('routes', function(done) {

    var routeFiles = $allonsy.findInFeaturesSync('controllers/' + filesPattern),
        publicPath = path.resolve('public'),
        routesTemplate = fs.readFileSync(path.resolve(__dirname, 'routes-routes-template.js'), 'utf-8'),
        routeTemplate = fs.readFileSync(path.resolve(__dirname, 'routes-route-template.js'), 'utf-8'),
        controllerTemplate = /{{controller}}([^]+){{\/controller}}/.exec(routeTemplate)[1],
        routes = [],
        types = ['enter', 'exit'];

    routeFiles.forEach(function(file) {
      delete require.cache[path.resolve(file)];

      var fileSplited = file.split('/'),
          filename = fileSplited.pop(),
          feature = fileSplited.pop() ? fileSplited.pop() : null,
          filePath = path.join(publicPath, feature, filename),
          fileUrl = '/public/' + feature + '/' + filename,
          routesConfig = require(path.resolve(file)),
          template = routeTemplate,
          controllers = [];

      if (!Array.isArray(routesConfig)) {
        routesConfig = [routesConfig];
      }

      routesConfig.forEach(function(routeConfig) {
        if (!feature || (!routeConfig.enter && !routeConfig.exit)) {
          return;
        }

        routeConfig.priority = typeof routeConfig.priority == 'undefined' ? 1 : routeConfig.priority;
        routeConfig.priority = routeConfig.priority == 'min' ? 0 : routeConfig.priority;
        routeConfig.priority = routeConfig.priority == 'max' ? 999999 : routeConfig.priority;

        var urls = routeConfig.urls || routeConfig.url;
        if (typeof urls == 'string') {
          urls = '\'' + urls + '\'';
        }
        else {
          urls = '[\'' + urls.join('\', \'') + '\']';
        }

        for (var i = 0; i < types.length; i++) {
          var type = types[i],
              funcString = '';

          if (typeof routeConfig[type] == 'function') {
            funcString = routeConfig[type].toString();
          }
          else if (Array.isArray(routeConfig[type])) {
            var funcArray = extend(true, [], routeConfig[type]);
            funcString = funcArray.pop().toString();

            if (funcArray.length) {
              funcString = '[\'' + funcArray.join('\', \'') + '\', ' + funcString + ']';
            }
          }

          if (routeConfig[type]) {
            controllers.push(controllerTemplate
              .replace('{{type}}', type)
              .replace('{{urls}}', urls)
              .replace('{{file}}', fileUrl)
              .replace('{{func}}', funcString)
            );
          }
        }

        routes.push({
          urls: urls,
          priority: routeConfig.priority,
          file: '/public/' + feature + '/' + filename,
          path: filePath,
          enter: !!routeConfig.enter,
          exit: !!routeConfig.exit
        });
      });

      fs.ensureDirSync(path.join(publicPath, feature));

      fs.writeFileSync(
        filePath,
        template.replace(/({{controller}}[^]+{{\/controller}})/, controllers.join(''))
      );
    });

    var routesContent = routesTemplate.replace('{{routes}}', '[\n' +
      routes
        .sort(function(a, b) {
          if (a.priority > b.priority) {
            return -1;
          }

          if (a.priority < b.priority) {
            return 1;
          }

          return 0;
        })
        .map(function(route) {
          return '        {urls: ' + route.urls + ', file: \'' + route.file + '\', enter: ' + route.enter + ', exit: ' + route.exit + '}';
        })
        .join(',\n') +
      '\n      ]'
    );

    fs.ensureDirSync(path.join(publicPath, 'routes'));

    var routesPath = path.join(publicPath, 'routes', 'routes.js');

    fs.writeFileSync(routesPath, routesContent);

    var src = routes.map(function(route) {
      return route.path;
    });

    src.push(routesPath);

    $gulp
      .src(src)
      .pipe(sourcemaps.init())
      .pipe(uglify())
      .pipe(rename({
        extname: '.min.js'
      }))
      .pipe(sourcemaps.write('./'))
      .pipe($gulp.dest(function(file) {
        var filePath = file.path.split(path.sep);
        filePath.pop();

        return filePath.join(path.sep);
      }))
      .on('end', done);
  });

  return {
    task: 'routes',
    watch: $allonsy.globPatterns('controllers/' + filesPattern)
  };
};
