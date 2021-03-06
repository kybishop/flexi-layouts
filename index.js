/* jshint node: true */
/* global require */
'use strict';

var LayoutCompiler = require('./lib/layout-compiler');
var mergeTrees = require('broccoli-merge-trees');
var Funnel = require('broccoli-funnel');
var path = require('path');
var fs = require('fs');
var commands = require('./lib/commands');

function assert(statement, test) {
  if (!test) {
    throw new Error(statement);
  }
}

module.exports = {
  name: 'flexi-layouts',

  included: function(app, parentAddon) {
    this._super.included.apply(this, arguments);

    // Quick fix for add-on nesting
    // https://github.com/aexmachina/ember-cli-sass/blob/v5.3.0/index.js#L73-L75
    // see: https://github.com/ember-cli/ember-cli/issues/3718
    while (typeof app.import !== 'function' && (app.app || app.parent)) {
      app = app.app || app.parent;
    }

    // if app.import and parentAddon are blank, we're probably being consumed by an in-repo-addon
    // or engine, for which the "bust through" technique above does not work.
    if (typeof app.import !== 'function' && !parentAddon) {
      if (app.registry && app.registry.app) {
        app = app.registry.app;
      }
    }

    if (!parentAddon && typeof app.import !== 'function') {
      throw new Error('flexi-layouts is being used within another addon or engine and is' +
        ' having trouble registering itself to the parent application.');
    }

    this.app = app;
    return app;
  },

  isDevelopingAddon: function() {
    return false;
  },

  _flexiConfig: null,
  flexiConfig: function() {
    if (!this._flexiConfig) {
      var configPath = path.join(this.project.root, 'config', 'flexi.js');

      if (fs.existsSync(configPath)) {
        this._flexiConfig = require(configPath);

        assert("config/flexi.js is defined, but could not be imported", this._flexiConfig);
        assert("config/flexi.js is defined, but did not contain property [array] breakpoints", this._flexiConfig.breakpoints instanceof Array);
        assert("config/flexi.js is defined, but did not contain property [number] columns", typeof this._flexiConfig.columns === 'number');

      } else {
        if (process.argv[2] !== 'install' && process.argv[3].indexOf('flexi') === -1) {
          throw new Error("You must define a config file for flexi at '" + configPath + "'");
        }
      }
    }
    return this._flexiConfig || {};
  },

  config: function() {
    var org = this._super.config.apply(this, arguments);

    org.flexi = this.flexiConfig();
    return org;
  },

  preprocessTree: function(type, tree) {
    if (type === 'template') {
      if (!tree) {
        throw new Error("No Template Tree is Present");
      }
      var layoutTree = new LayoutCompiler(tree, { breakpoints: this.flexiConfig().breakpoints });
      var templateTree = new Funnel(tree, {
        exclude: ['**/-layouts/*.hbs']
      });
      return mergeTrees([templateTree, layoutTree], { overwrite: true });
    }

    return tree;
  },

  includedCommands: function () {
    return commands;
  }

};
