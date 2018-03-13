'use strict';
const path = require('path');
const fs = require('fs');
const _ = require('lodash');

function PowerBICustomVisualsWebpackPlugin(options) {
  const name = "SampleVisual";
  var defaultOptions = {
      visual: {
        name: name,
        displayName: name,
        guid: `${name}_${new Date().getTime()}_${Math.random().toString().substr(2)}`,
        visualClassName: "Visual",
        version: "1.0.0.0",
        description: "",
        supportUrl: "",
        author: ""
    },
    apiVersion: "1.10.0",
    stringResourcesPath: [
      ""
    ],
    capabilities: {},
    iconImage: "",
    devMode: true
  };

  this.options = Object.assign(defaultOptions, options);
}

PowerBICustomVisualsWebpackPlugin.prototype.apply = function(compiler) {
  const options = this.options;
  const encoding = "utf8";
  const pluginFileName = "visualPlugin.js";

    compiler.plugin("compile", (compilation, callback) => {
        console.log();
    });

    compiler.plugin("emit", (compilation, callback) => {
    // generate pbiviz.json for dev server
    var stringResources = "";
    if (this.options.stringResourcesPath && this.options.stringResourcesPath.length) {
      this.options.stringResourcesPath.forEach(resource => {
        stringResources += fs.existsSync(resource) ? fs.readFileSync(resource, encoding): "";
      });
    }
    var capabilities = "";
    if (this.options.capabilities) {
      capabilities = fs.existsSync(this.options.capabilities) ? fs.readFileSync(this.options.capabilities, encoding) : "";
    }

    let jsContent = "";
    let jsPath = "";

    let cssContent = "";
    let cssPath = "visual.css";
    const iconImage = "";
    
    let visualFileName = "";
    for(let asset in compilation.assets) {
      if (asset.split('.').pop() === "js") {
        jsPath = asset;
        jsContent = compilation.assets[asset].source();
      }
      if (asset.split('.').pop() === "css") {
        cssPath = asset;
        cssContent = compilation.assets[asset].source();
      }
    }

    if (!cssContent) {
      // if css file wasn't specified, generate empty css file because PBI requres this file from dev server
      compilation.assets["visual.css"] = {
        source: function() {
          return "";
        },
        size: function() {
          return 0;
        }
      };
    }

    // generate visual plugin for dev server
    let pluginOptions = {
      pluginName: `${this.options.visual.guid}${ options.devMode ? '_DEBUG' : ''}`,
      visualGuid: this.options.visual.guid,
      visualClass: this.options.visual.visualClassName,
      visualDisplayName: this.options.visual.displayName,
      visualVersion: this.options.visual.version,
      apiVersion: this.options.apiVersion
    };

    let pluginTemplate = fs.readFileSync(path.join(__dirname, "templates", "plugin.ts.template"));
    let pluginTs = _.template(pluginTemplate)(pluginOptions);

    compilation.assets[pluginFileName] = {
      source: function() {
        return pluginTs;
      },
      size: function() {
        return pluginTs.length;
      }
    };

    // append plugin code to visual code;
    jsContent += `\n ${pluginTs}`;

    compilation.assets[jsPath] = {
      source: function() {
        return jsContent;
      },
      size: function() {
        return jsContent.length;
      }
    };

    var jsonData = {
      visual: {
          name: this.options.visual.name,
          displayName: this.options.visual.displayName,
          guid: `${this.options.visual.guid}${ options.devMode ? '_DEBUG' : ''}`,
          visualClassName: this.options.visual.visualClassName,
          version: this.options.visual.version,
          description: this.options.visual.description,
          supportUrl: this.options.visual.supportUrl,
          apiVersion: this.options.apiVersion,
          author: this.options.visual.author
      },
      apiVersion: this.options.apiVersion,
      style: "style/visual.less",
      stringResources: stringResources,
      capabilities: capabilities,
      content: {
          js: jsContent,
          css: cssContent,
          iconBase64: iconImage
      }
    };

    var jsonDataString = JSON.stringify(jsonData);

    compilation.assets["pbiviz.json"] = {
      source: function() {
        return jsonDataString;
      },
      size: function() {
        return jsonDataString.length;
      }
    };

    // update status file for debug server
    const status = `${new Date().getTime()}\n${this.options.visual.guid}${ options.devMode ? '_DEBUG' : ''}`;
    compilation.assets["status"] = {
      source: function() {
        return status;
      },
      size: function() {
        return status.length;
      }
    };

    callback();
  });
};

module.exports = PowerBICustomVisualsWebpackPlugin;