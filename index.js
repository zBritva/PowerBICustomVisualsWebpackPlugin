'use strict';
const path = require('path');
const fs = require('fs');
const _ = require('lodash');

const base64Img = require('base64-img');
const JSZip = require('jszip');
var UglifyJS = require("uglify-js");

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
        supportUrl: ""
    },
    author: "",
    apiVersion: "1.10.0",
    stringResourcesPath: [
      ""
    ],
    capabilities: {},
    iconImage: base64Img.base64Sync(path.join(__dirname, "templates", "icon.png")),
    devMode: true,
    packageOutPath: path.join(process.cwd(), "distr")
  };

  this.options = Object.assign(defaultOptions, options);
}

PowerBICustomVisualsWebpackPlugin.prototype.apply = function(compiler) {
  const options = this.options;
  const encoding = "utf8";
  const pluginFileName = "visualPlugin.js";

    compiler.plugin("beforeCompile", (compilationParams) => {
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

    if (stringResources === "") {
      stringResources = this.options.stringResources;
    }

    var capabilities = this.options.capabilities;

    let jsContent = "";
    let jsContentOrigin = "";
    let jsPath = "";

    let externalJSOrigin = "";
    let externalJSOriginPath = "";

    let cssContent = "";
    let cssPath = "visual.css";
    
    let visualFileName = "";
    for(let asset in compilation.assets) {
      if (asset.split('.').pop() === "js") {
        jsPath = asset;
        jsContentOrigin = compilation.assets[asset].source();
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

    // append externalJS files content to visual code;
    if (this.options.externalJS) {
      for (let file in this.options.externalJS) {
        let fileContent = fs.readFileSync(this.options.externalJS[file], {
          encoding: encoding
        });
        externalJSOrigin += `\n ${fileContent}`;
      }
    }

    externalJSOrigin += "\nvar globalPowerbi = powerbi;\n";

    jsContent += externalJSOrigin;
    jsContent += jsContentOrigin;
    jsContent += `\n ${pluginTs}`;

    compilation.assets[jsPath] = {
      source: function() {
        return jsContent;
      },
      size: function() {
        return jsContent.length;
      }
    };

    var visualConfig = {
      visual: {
          name: this.options.visual.name,
          displayName: this.options.visual.displayName,
          guid: `${this.options.visual.guid}${ options.devMode ? '_DEBUG' : ''}`,
          visualClassName: this.options.visual.visualClassName,
          version: this.options.visual.version,
          description: this.options.visual.description,
          supportUrl: this.options.visual.supportUrl,
          apiVersion: this.options.apiVersion
      },
      author: this.options.author,
      apiVersion: this.options.apiVersion,
      style: "style/visual.less",
      stringResources: stringResources,
      capabilities: capabilities,
      content: {
          js: jsContent,
          css: cssContent,
          iconBase64: this.options.iconImage
      }
    };

    var pbivizJSONData = JSON.stringify(visualConfig);

    compilation.assets["pbiviz.json"] = {
      source: function() {
        return pbivizJSONData;
      },
      size: function() {
        return pbivizJSONData.length;
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

    if (!this.options.devMode) {
      let dropPath = this.options.packageOutPath
      if(!fs.existsSync(dropPath)) {
        fs.mkdir(dropPath);
      }
      let resourcePath = path.join(dropPath, 'resources');
      if(!fs.existsSync(resourcePath)) {
        fs.mkdir(resourcePath);
      }

      let visualConfigProd = _.cloneDeep(visualConfig);
      visualConfigProd.visual.guid = `${this.options.visual.guid}`;
      visualConfigProd.visual.gitHubUrl = visualConfigProd.visual.gitHubUrl || "";
      
      let templateOptions = {
          visualData: visualConfigProd.visual || {},
          authorData: visualConfigProd.author || {
            name: "",
            email: ""
          },
          guid: visualConfigProd.visual.guid
      };
      let packageTemplate = fs.readFileSync(path.join(__dirname, "templates", "package.json.template"));
      delete templateOptions.visualData.apiVersion;
      let packageJSONContent = _.template(packageTemplate)(templateOptions);
      let pbivizJsonContent = fs.writeFileSync(path.join(dropPath, 'package.json'), packageJSONContent);

      let jsContentProd = "";

      /// load external js
      if (this.options.externalJS) {
        for (let file in this.options.externalJS) {
          let fileContent = fs.readFileSync(this.options.externalJS[file], {
            encoding: encoding
          });
          jsContentProd += `\n ${fileContent}`;
        }
      }

      let pluginOptionsProd = _.cloneDeep(pluginOptions);
      pluginOptionsProd.pluginName = `${this.options.visual.guid}`;

      let pluginTsProd = _.template(pluginTemplate)(pluginOptionsProd);


      jsContentProd += externalJSOrigin;
      jsContentProd += jsContentOrigin;
      jsContentProd += `\n ${pluginTsProd}`;
      let uglifyed =  UglifyJS.minify(jsContentProd);
      if (!uglifyed.error) {
        jsContentProd = uglifyed.code;
      }
      else {
        console.error(uglifyed.error.message);
      }
      //we deliberately overwrite the dependencies property to make sure it will be undefined when no dependencies file was supplied
      // distPbiviz.dependencies = dependencies;

      //we deliberately overwrite the stringResources property to make sure it will be undefined when no stringResources file was supplied
      // distPbiviz.stringResources = localization;
      visualConfigProd.content = {
        js: jsContentProd,
        css: cssContent,
        iconBase64: this.options.iconImage
      }
      visualConfigProd.externalJS = [];
      visualConfigProd.assets =  {
        "icon": "assets/icon.png"
      };

      fs.writeFileSync(path.join(resourcePath, `${this.options.visual.guid}.pbiviz.json`), JSON.stringify(visualConfigProd));
      fs.writeFileSync(path.join(resourcePath, 'visual.prod.js'), jsContentProd);
      fs.writeFileSync(path.join(resourcePath, 'visual.prod.css'), cssContent);

      let zip = new JSZip();
      zip.file('package.json', packageJSONContent);
      let resources = zip.folder("resources");
      resources.file(`${this.options.visual.guid}.pbiviz.json`, JSON.stringify(visualConfigProd));
      zip.generateAsync({ type: 'nodebuffer' })
          .then(content => 
            fs.writeFileSync(
              path.join(
                dropPath,
                `${this.options.visual.guid}.${this.options.visual.version}.pbiviz`),
              content)
          );
    }

    callback();
  });
};

PowerBICustomVisualsWebpackPlugin.prototype.createPackage = function(visualConfig) {

}

module.exports = PowerBICustomVisualsWebpackPlugin;