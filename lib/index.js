var Express = require('express');
var gplay = require('google-play-scraper');
var url = require('url');
var path = require('path');
var qs = require('querystring');
var _ = require('lodash')

var app = Express();
app.enable('trust proxy');
var router = Express.Router();

/* Index */
router.get('/', function(req, res) {
    res.json({
        apps: buildUrl(req, 'apps'),
        developers: buildUrl(req, 'developers')
    });
});

/* App search */
router.get('/apps/', function(req, res, done) {
    if (!req.query.q) {
        return done();
    }

    var opts = _.assign({term: req.query.q}, req.query);

    gplay.search(opts).each(cleanUrls(req)).then(toList)
        .then(res.json.bind(res), error(res));
});

/* Search suggest */
router.get('/apps/', function(req, res, done) {
    if (!req.query.suggest) {
        return done();
    }

    gplay.suggest(req.query.suggest).map(function(term){
        return {
            term: term,
            url: buildUrl(req, '/apps/') + '?' + qs.stringify({q: term})
        };
    }).then(toList).then(res.json.bind(res), error(res));
});

/* App list */
router.get('/apps/', function(req, res) {

    function paginate(apps) {
        var num = parseInt(req.query.num || '60');
        var start = parseInt(req.query.start || '0');

        if (start - num >= 0) {
            req.query.start = start - num;
            apps.prev = buildUrl(req, '/apps/') + '?' + qs.stringify(req.query);
        }

        if (start + num <= 500) {
            req.query.start = start + num;
            apps.next = buildUrl(req, '/apps/') + '?' + qs.stringify(req.query);
        }

        return apps;
    }

    gplay.list(_.clone(req.query)).each(cleanUrls(req))
        .then(toList).then(paginate)
        .then(res.json.bind(res), error(res));
});

/* App detail*/
router.get('/apps/:appId', function(req, res) {
    var opts = _.assign({appId: req.params.appId}, req.query);
    gplay.app(opts).then(cleanUrls(req))
        .then(res.json.bind(res), error(res));
});

/* Similar apps */
router.get('/apps/:appId/similar', function(req, res) {
    var opts = _.assign({appId: req.params.appId}, req.query);
    gplay.similar(opts).each(cleanUrls(req)).then(toList)
        .then(res.json.bind(res), error(res));
});

/* App reviews */
router.get('/apps/:appId/reviews', function(req, res) {

    function paginate(apps) {
        var page = parseInt(req.query.page || '0');

        var subpath = '/apps/' + req.params.appId + '/reviews/';
        if (page > 0) {
            req.query.page = page - 1;
            apps.prev = buildUrl(req, subpath) + '?' + qs.stringify(req.query);
        }

        if (apps.results.length) {
            req.query.page = page + 1;
            apps.next = buildUrl(req, subpath) + '?' + qs.stringify(req.query);
        }

        return apps;
    }

    var opts = _.assign({appId: req.params.appId}, req.query);
    gplay.reviews(opts).then(toList).then(paginate)
        .then(res.json.bind(res), error(res));
});

/* Apps by developer */
router.get('/developers/:devId/', function(req, res) {
    var opts = _.assign({devId: req.params.devId}, req.query);
    gplay.developer(opts).each(cleanUrls(req)).then(toList)
        .then(res.json.bind(res), error(res));
});

/* Developer list (not supported) */
router.get('/developers/', function(req, res) {
    res.status(400).json({
        message: 'Please specify a developer id.',
        example: buildUrl(req, '/developers/DxCo Games')
    });
});

app.use('/gps-api', router);
module.exports = app;

function error(res) {
    return function(e) {
        res.status(400).json({message: e.message});
    };
}

function toList(apps) {
    return {results: apps};
}

function cleanUrls(req) {
    return function (app) {
        app.playstoreUrl = app.url;
        app.url = buildUrl(req, 'apps/' + app.appId);
        app.similar = buildUrl(req, 'apps/' + app.appId + '/similar');
        app.reviews = buildUrl(req, 'apps/' + app.appId + '/reviews');
        return app;
    };
}

function buildUrl(req, subpath) {
    var basePath = req.originalUrl; //full url
    var routerPath = req.baseUrl;
    basePath = basePath.split(routerPath)[0]; //drops the api subpath

    return url.format({
        protocol: req.protocol,
        host: req.get('host'),
        pathname: path.join(basePath, routerPath, subpath, '/')
      });
}
