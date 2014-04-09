'use strict';

var utils = require('./utils');

var schema = {};
var schemaValidation = {};
var schemaValidator = {};
var schemaDefaults = {};

var UNDEFINED = 'undefined';
var FUNCTION = 'function';
var OBJECT = 'object';
var STRING = 'string';
var NUMBER = 'number';
var BOOLEAN = 'boolean';
var REQUIRED = 'The field "@" is required.';

/*
    @onResource {Function} :: function(name, key) return {String}
*/
function ErrorBuilder(onResource) {
	this.errors = [];
	this.onResource = onResource;
	this.resourceName = '';
	this.resourcePrefix = '';
	this.length = 0;
	this.replacer = [];
	this.isPrepared = false;
	if (typeof(onResource) === UNDEFINED)
		this._resource();
}

function UrlBuilder() {
	this.builder = {};
}

/*
    @items {Number}
    @page {Number}
    @max {Number}
    @format {String}, optional
*/
function Pagination(items, page, max, format) {
	this.isNext = false;
	this.isPrev = false;
	this.items = items;
	this.count = 0;
	this.skip = 0;
	this.take = 0;
	this.page = 0;
	this.max = 0;
	this.visible = false;
	this.format = format || '?page={0}';
	this.refresh(items, page, max);
}

/*
	Create object schema
    @name {String}
    @obj {Number}
    @defaults {Function} :: optional
    @validator {Function} :: optional
    return {Object}
*/
exports.schema = function(name, obj, defaults, validator) {

	if (typeof(obj) === UNDEFINED)
		return schema[name] || null;

	if (typeof(defaults) === FUNCTION)
		schemaDefaults[name] = defaults;

	if (typeof(validator) === FUNCTION)
		schemaValidator[name] = validator;

	schema[name] = obj;
	return obj;
};

exports.isJoin = function(value) {
	if (!value)
		return false;
	if (value[0] === '[')
		return true;
	return typeof(schema[value]) !== UNDEFINED;
};

/*
	Create schema validation
	@name {String},
	@arr {String Array}
	return {String Array}
*/
exports.validation = function(name, arr) {
	
	if (typeof(arr) === FUNCTION) {
		schemaValidator[name] = arr;
		return true;
	}

	if (typeof(arr) === UNDEFINED)
		return schemaValidation[name] || [];

	schemaValidation[name] = arr;
	return arr;
};

/*
	Validate schema model
	@name {String} :: schema name
	@model {Object} :: model
	return {ErrorBuilder}
*/
exports.validate = function(name, model) {

	var fn = schemaValidator[name];
	var builder = new ErrorBuilder();

	if (typeof(fn) === UNDEFINED)
		return builder;

	return utils.validate.call(this, model, Object.keys(schema[name]), fn, builder);
};

exports.default = function(name) {
	return exports.defaults(name);
};

/*
	Create schema object
    @name {String}
    return {Object}
*/
exports.defaults = function(name) {

	var obj = exports.schema(name);

	if (obj === null)
		return null;

	var defaults = schemaDefaults[name];
	var item = utils.extend({}, obj, true);
	var properties = Object.keys(item);
	var length = properties.length;

	for (var i = 0; i < length; i++) {

		var property = properties[i];
		var value = item[property];
		var type = typeof(value);

		if (defaults) {
			var def = defaults(property, true);
			if (typeof(def) !== UNDEFINED) {
				item[property] = def;
				continue;
			}
		}

		if (type === FUNCTION) {

			if (value === Number) {
				item[property] = 0;
				continue;
			}

			if (value === Boolean) {
				item[property] = false;
				continue;
			}

			if (value === String) {
				item[property] = '';
				continue;
			}

			if (value === Date) {
				item[property] = new Date();
				continue;
			}

			if (value === Object) {
				item[property] = {};
				continue;
			}

			if (value === Array) {
				item[property] = [];
				continue;
			}

			item[property] = value();
			continue;
		}

		if (type === NUMBER) {
			item[property] = 0;
			continue;
		}

		if (type === BOOLEAN) {
			item[property] = false;
			continue;
		}

		if (type === OBJECT) {
			item[property] = value instanceof Array ? [] : {};
			continue;
		}

		if (type !== STRING) {
			item[property] = null;
			continue;
		}

		var isArray = value[0] === '[';

		if (isArray)
			value = value.substring(1, value.length - 1);

		if (isArray) {
			item[property] = [];
			continue;
		}

		var lower = value.toLowerCase();

		if (lower.contains([STRING, 'text', 'varchar', 'nvarchar', 'binary', 'data', 'base64'])) {
			item[property] = '';
			continue;
		}

		if (lower.contains(['int', NUMBER, 'decimal', 'byte', 'float', 'double'])) {
			item[property] = 0;
			continue;
		}

		if (lower.contains('bool')) {
			item[property] = false;
			continue;
		}

		if (lower.contains(['date', 'time'])) {
			item[property] = new Date();
			continue;
		}

		if (lower.contains(['object'])) {
			item[property] = {};
			continue;
		}

		if (lower.contains(['array'])) {
			item[property] = [];
			continue;
		}

		if (lower.contains(['binary', 'data', 'base64'])) {
			item[property] = null;
			continue;
		}

		item[property] = exports.defaults(value);
	}

	return item;
};

/*
	Prepare model to schema
    @name {String}
    @model {Object}
    return {Object}
*/
exports.prepare = function(name, model) {

	var obj = exports.schema(name);

	if (obj === null)
		return null;

	if (model === null)
		return exports.defaults(name);

	var tmp;
	var item = utils.extend({}, obj, true);
	var properties = Object.keys(item);
	var defaults = schemaDefaults[name];
	var length = properties.length;

	for (var i = 0; i < length; i++) {

		var property = properties[i];
		var val = model[property];

		if (typeof(val) === UNDEFINED && defaults)
			val = defaults(property, false);

		if (typeof(val) === UNDEFINED)
			val = '';

		var value = item[property];
		var type = typeof(value);
		var typeval = typeof(val);

		if (typeval === FUNCTION)
			val = val();

		if (type === FUNCTION) {

			if (value === Number) {
				item[property] = utils.parseFloat(val);
				continue;
			}

			if (value === Boolean) {
				tmp = val.toString();
				item[property] = tmp === 'true' || tmp === '1';
				continue;
			}

			if (value === String) {
				item[property] = val.toString();
				continue;
			}

			if (value === Date) {

				tmp = null;

				switch (typeval) {
					case OBJECT:
						if (utils.isDate(val))
							tmp = val;
						else
							tmp = null;
						break;

					case NUMBER:
						tmp = new Date(val);
						break;

					case STRING:
						if (val === '')
							tmp = null;
						else
							tmp = val.parseDate();
						break;
				}

				if (tmp !== null && typeof(tmp) === OBJECT && tmp.toString() === 'Invalid Date')
					tmp = null;

				item[property] = tmp || (defaults ? isUndefined(defaults(property), null) : null);
				continue;
			}

			item[property] = isUndefined(defaults(property), null);
			continue;
		}

		if (type === OBJECT) {
			item[property] = typeval === OBJECT ? val : null;
			continue;
		}

		if (type === NUMBER) {
			item[property] = utils.parseFloat(val);
			continue;
		}

		if (val === null || typeval === UNDEFINED)
			tmp = '';
		else
			tmp = val.toString();

		if (type === BOOLEAN) {
			item[property] = tmp === 'true' || tmp === '1';
			continue;
		}

		if (type !== STRING) {
			item[property] = tmp;
			continue;
		}

		var isArray = value[0] === '[' || value === 'array';

		if (isArray) {

			if (value[0] === '[')
				value = value.substring(1, value.length - 1);
			else
				value = null;

			if (!(val instanceof Array)) {
				item[property] = (defaults ? isUndefined(defaults(property, false), []) : []);
				continue;
			}

			item[property] = [];
			var sublength = val.length;
			for (var j = 0; j < sublength; j++) {

				if (value === null) {
					item[property].push(model[property][j]);
					continue;
				}

				var tmp = model[property][j];

				switch (value) {
					case 'string':
					case 'varchar':
					case 'text':
						item[property].push((tmp || '').toString());
						break;
					case 'bool':
					case 'boolean':
						tmp = (tmp || '').toString().toLowerCase();
						item[property].push(tmp === 'true' || tmp === '1');
						break;
					case 'int':
					case 'integer':
						item[property].push(utils.parseInt(tmp));
						break;
					case 'number':
						item[property].push(utils.parseFloat(tmp));
						break;
					default:
						item[property][j] = exports.prepare(value, model[property][j]);
						break;
				}
			}

			continue;
		}

		var lower = value.toLowerCase();

		if (lower.contains([STRING, 'text', 'varchar', 'nvarchar'])) {

			var beg = lower.indexOf('(');
			if (beg === -1) {
				item[property] = tmp;
				continue;
			}

			var size = lower.substring(beg + 1, lower.length - 1).parseInt();
			item[property] = tmp.max(size, '...');
			continue;
		}

		if (lower.contains(['int', 'byte'])) {
			item[property] = utils.parseInt(val);
			continue;
		}

		if (lower.contains(['decimal', NUMBER, 'float', 'double'])) {
			item[property] = utils.parseFloat(val);
			continue;
		}

		if (lower.contains('bool', BOOLEAN)) {
			item[property] = tmp === 'true' || tmp === '1';
			continue;
		}

		if (lower.contains(['date', 'time'])) {

			if (typeval === 'date') {
				item[property] = val;
				continue;
			}

			if (typeval === STRING) {
				item[property] = val.parseDate();
				continue;
			}

			if (typeval === NUMBER) {
				item[property] = new Date(val);
				continue;
			}

			item[property] = isUndefined(defaults(property));
			continue;
		}

		item[property] = exports.prepare(value, model[property]);
	}

	return item;
};

function isUndefined(value, def) {
	if (typeof(value) === UNDEFINED)
		return def;
	return value;
}

// ======================================================
// PROTOTYPES
// ======================================================

/*
	Set resource
	@name {String} :: resource filename
	@prefix {String}
	return {ErrorBuilder}
*/
ErrorBuilder.prototype.resource = function(name, prefix) {
	var self = this;
	self.resourceName = name;
	self.resourcePrefix = prefix || '';
	return self._resource();
};

ErrorBuilder.prototype._resource = function() {
	var self = this;
	self.onResource = function(name) {
		var self = this;
		return framework.resource(self.resourceName, self.resourcePrefix + name);
	};
	return self;
};

/*
	Add a new error
	@name {String or ErrorBuilder}
	@error {String} :: default value @ (for resources)
    return {ErrorBuilder}
*/
ErrorBuilder.prototype.add = function(name, error, path) {
	var self = this;
	self.isPrepared = false;

	if (name instanceof ErrorBuilder) {

		name.errors.forEach(function(o) {
			self.errors.push(o);
		});

		self.length = self.errors.length;
		return self;
	}

	self.errors.push({ name : name, error: error || '@', path: path });
	self.length = self.errors.length;
	return self;
};

/*
	Remove error
	@name {String}
    return {ErrorBuilder}
*/
ErrorBuilder.prototype.remove = function(name) {
	var self = this;

	self.errors = self.errors.remove(function(o) {
		return o.name === name;
	});

	self.length = self.errors.length;
	return self;
};

/*
	@name {String} :: optional, default undefined
    return {Boolean}
*/
ErrorBuilder.prototype.hasError = function(name) {
	var self = this;

	if (name) {
		return self.errors.find(function(o) {
			return o.name === name;
		}) !== null;
	}

	return self.errors.length > 0;
};

/*
	Read error message
	@name {String}
	return {String}
*/
ErrorBuilder.prototype.read = function(name) {

	var self = this;

	if (!self.isPrepared)
		self.prepare();

	var error = self.errors.find(function(o) {
		return o.name === name;
	});

	if (error !== null)
		return error.error;

	return null;
};

/*
	Clear ErrorBuilder
    return {ErrorBuilder}
*/
ErrorBuilder.prototype.clear = function() {
	var self = this;
	self.errors = [];
	self.length = 0;
	return self;
};

/*
	Add a replace rule
	@search {String}
	@newvale {String}
    return {ErrorBuilder}
*/
ErrorBuilder.prototype.replace = function(search, newvalue) {
	var self = this;
	self.isPrepared = false;
	self.replacer[search] = newvalue;
	return self;
};

/*
	Serialize ErrorBuilder to JSON format
    return {String}
*/
ErrorBuilder.prototype.json = function(beautify) {
	if (beautify)
		return JSON.stringify(this.prepare().errors, null, '\t');
	return JSON.stringify(this.prepare().errors);
};

/*
	Serialize ErrorBuilder to JSON format
    return {String}
*/
ErrorBuilder.prototype.JSON = function() {
	return JSON.stringify(this.prepare().errors);
};

/*
	Prepare builder with Resources
    return {ErrorBuilder}
*/
ErrorBuilder.prototype._prepare = function() {
	var self = this;

	if (self.onResource === null)
		return self;

	var errors = self.errors;
	var length = errors.length;

	for (var i = 0; i < length; i++) {

		var o = errors[i];

		if (o.error[0] !== '@')
			continue;

		if (o.error.length === 1)
			o.error = self.onResource(o.name);
		else
			o.error = self.onResource(o.error.substring(1));

		if (typeof(o.error) === UNDEFINED)
			o.error = REQUIRED.replace('@', o.name);
	}

	return self;
};

ErrorBuilder.prototype._prepareReplace = function() {

	var self = this;
	var errors = self.errors;
	var lengthBuilder = errors.length;
	var keys = Object.keys(self.replacer);
	var lengthKeys = keys.length;

	if (lengthBuilder === 0 || lengthKeys === 0)
		return self;

	for (var i = 0; i < lengthBuilder; i++) {
		var o = errors[i];
		for (var j = 0; j < lengthKeys; j++) {
			var key = keys[j];
			o.error = o.error.replace(key, self.replacer[key]);
		}
	}

	return self;
};

ErrorBuilder.prototype.prepare = function() {
	var self = this;

	if (self.isPrepared)
		return self;

	self._prepare()._prepareReplace();
	self.isPrepared = true;

	return self;
};

/*
	Refresh Pagination
	@items {Number}
	@page {Number}
	@max {Number}
    return {Pagination}
*/
Pagination.prototype.refresh = function(items, page, max) {
	var self = this;

	self.count = Math.floor(items / max) + (items % max > 0 ? 1 : 0);
	self.page = page - 1;

	if (self.page < 0)
		self.page = 0;

	self.items = items;
	self.skip = self.page * max;
	self.take = max;
	self.max = max;
	self.isPrev = self.page > 0;
	self.isNext = self.page < self.count - 1;
	self.visible = self.count > 1;
	self.page++;

	return self;
};

/*
	Get previous page
	@format {String} :: optional
	return {Object}
*/
Pagination.prototype.prev = function(format) {
	var self = this;
	var page = 0;

	format = format || self.format;

	if (self.isPrev)
		page = self.page - 1;
	else
		page = self.count;

	return { url: format.replace(/\{0\}/g, page), page: page, selected: false };
};

/*
	Get next page
	@format {String} :: optional
	return {Object}
*/
Pagination.prototype.next = function(format) {
	var self = this;
	var page = 0;

	format = format || self.format;

	if (self.isNext)
		page = self.page + 1;
	else
		page = 1;

	return { url: format.replace(/\{0\}/g, page), page: page, selected: false };
};


/*
	Render Pagination
	@fn {Function} :: function(pageIndex)
	@max {Number} :: optional, default undefined
    return {Array}
*/
Pagination.prototype.render = function(max, format) {

	var self = this;
	var builder = [];
	format = format || self.format;

	if (typeof(max) === STRING) {
		var tmp = format;
		format = max;
		max = format;
	}

	if (typeof(max) === UNDEFINED) {
		for (var i = 1; i < self.count + 1; i++)
			builder.push({ url: format.replace(/\{0\}/g, i), page: i, selected: i === self.page });
		return builder;
	}

	var half = Math.floor(max / 2);
	var pages = self.count;

	var pageFrom = self.page - half;
	var pageTo = self.page + half;
	var plus = 0;

	if (pageFrom <= 0) {
		plus = Math.abs(pageFrom);
		pageFrom = 1;
		pageTo += plus;
	}

	if (pageTo >= pages) {
		pageTo = pages;
		pageFrom = pages - max;
	}

	if (pageFrom < 0)
		pageFrom = 1;

	for (var i = pageFrom; i < pageTo + 1; i++)
		builder.push({ url: format.replace(/\{0\}/g, i), page: i, selected: i === self.page });

	return builder;
};

/*
	Add parameter to UrlBuilder
	@name {String}
	@value {String}
    return {UrlBuilder}
*/
UrlBuilder.prototype.add = function(name, value) {
	var self = this;

	if (typeof(name) === 'object') {
		Object.keys(name).forEach(function(o) {
			self.builder[o] = name[o];
		});
		return;
	}

	self.builder[name] = value;
	return self;
};

/*
	Remove parameter from UrlBuilder
	@name {String}
    return {UrlBuilder}
*/
UrlBuilder.prototype.remove = function(name) {
	var self = this;
	delete self.builder[name];
	return self;
};

/*
	Read parameter
	@name {String}
    return {Object}
*/
UrlBuilder.prototype.read = function(name) {
	return this.builder[name] || null;
};

/*
	Remove all keys
    return {UrlBuilder}
*/
UrlBuilder.prototype.clear = function() {
	var self = this;
	self.builder = {};
	return self;
};

/*
	Create URL
    return {String}
*/
UrlBuilder.prototype.toString = function() {

	var self = this;
	var builder = [];

	Object.keys(self.builder).forEach(function(o) {
		builder.push(o + '=' + encodeURIComponent(self.builder[o] || ''));
	});

	return builder.join('&');
};

/*
	Has UrlBuilder values?
	@keys {String or String array}
    return {Boolean}
*/
UrlBuilder.prototype.hasValue = function(keys) {

	if (typeof(keys) === UNDEFINED)
		return false;

	var self = this;

	if (typeof(keys) === 'string')
		keys = [keys];

	for (var i = 0; i < keys.length; i++) {
		var val = self.builder[keys[i]];
		if (typeof(val) === UNDEFINED || val === null)
			return false;
	}

	return true;
};

/*
	Render parameter
	@keys {String array} :: what parameter
	@delimiter {String}
    return {String}
*/
UrlBuilder.prototype.toOne = function(keys, delimiter) {

	var self = this;
	var builder = [];

	keys.forEach(function(o) {
		builder.push(self.builder[o] || '');
	});

	return builder.join(delimiter || '&');
};

// ======================================================
// EXPORTS
// ======================================================

exports.ErrorBuilder = ErrorBuilder;
exports.Pagination = Pagination;
exports.UrlBuilder = UrlBuilder;