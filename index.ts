/// <reference path="_ref.d.ts" />

var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
var FN_PARTS = /^function\s*([^\(]*)\(\s*([^\)]*)\)/m;
var FN_ARG_SPLIT = /,\s*/;
var FN_NAME_PARTS = /_\$/;

var construct = (service: Function, args: Array < any > ) => {
    function F() {
        service.apply(this, args);
    }

    F.prototype = service.prototype;
    return new F();
}

class NestContainerRegistratorBasic implements Nest.IContainerRegistrator {

    q: Nest.IAsync;
    container: Nest.IContainer;

    constructor(app: Nest.INest) {
        var q = app.modules.filter((x, i, a) => {
            return x.key === 'IAsync';
        })[0];
        if (!q)
            throw 'IAsync was not found on app, but is required for NestContainerRegistratorBasic';

        var container = app.modules.filter((x, i, a) => {
            return x.key === 'IContainer';
        })[0];

        if (!container)
            throw 'IContainer was not found on app, but is required for NestContainerRegistratorBasic';

        this.q = q.instance;
        this.container = container.instance;
    }

    register(service: Nest.ModuleFunction) {

        var name = service.$serviceName;
        var key = service.$serviceKey;
        var factory = service.$serviceFactory;


        if (typeof service === 'function' && (name === undefined || key === undefined || factory === undefined)) {
            var fnText = service.toString().replace(STRIP_COMMENTS, '');

            var parts = fnText.match(FN_PARTS);

            if (parts && parts.length === 3) {

                if (name === undefined || key === undefined) {
                    var nameParts = parts[1].split(FN_NAME_PARTS);

                    if (name === undefined)
                        name = 'I' + nameParts[1];

                    if (key === undefined)
                        key = nameParts[0];
                }

                if (factory === undefined) {
                    var args: Array < string > ;

                    if (parts[2].length > 0)
                        args = parts[2].split(FN_ARG_SPLIT).map((v, i, a) => {
                            return 'I' + v.charAt(0).toUpperCase() + v.slice(1);
                        });
                    else
                        args = [];

                    factory = () => {
                        return this.q.all(args.map((v, i, a) => {
                            return this.container.require(v);
                        }))
                            .then((args: Array < any > ) => {
                                return construct(service, args);
                            });
                    };
                }
            }
        }

        if (name && key && factory)
            this.container.define(name, key, factory);

        return this;
    }
}

module.exports.step = function(app: Nest.INest, done: () => any) {
    app.modules.push({
        name: 'IContainerRegistrator',
        key: 'NestContainerRegistratorBasic',
        instance: new NestContainerRegistratorBasic(app),
    });
}