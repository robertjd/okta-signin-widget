define([
  'okta/underscore',
  'okta/jquery',
  'shared/util/TemplateUtil',
  '../BaseInput',
  'shared/util/BatchAjaxUtil',
  'vendor/plugins/jquery.autosuggest-1.4.min'
],
function (_, $, TemplateUtil, BaseInput, BatchAjaxUtil) {

  var events = {
    'keyup': function (e) {
      e.stopPropagation();
    }
  };

  function escapeEntity(entity) {
    var target = {};
    _.each(entity, function (value, key) {
      var tagetKey = _.escape(key);
      if (_.isObject(value)) {
        target[tagetKey] = escapeEntity(value);
      }
      else if (_.isString(value)) {
        target[tagetKey] = escape(value);
      }
      else {
        target[tagetKey] = value;
      }
    });
    return target;
  }


  // because the attributes we render in the html typically exist outside of html atributes,
  // the only things we need to escape are html tags.
  // using this poor man's escaping instead of _.escape prevents a bug where entities with ampersands or quotes
  // in the name where not being displayed due to mis-matching name compared with the original query.
  function escape(value) {
    return value.replace(/>/g, '&gt;').replace(/</g, '&lt;');
  }

  /**
  * @class BasePicker
  * @extends BaseInput
  * @private
  * An abstract input for API based autosuggest widgets
  */

  return BaseInput.extend({

    template: TemplateUtil.tpl('<input type="text" name="{{name}}" id="{{inputId}}"/>'),

    events: {},

    /**
     * @property {String} idAttribute the id attribute to operate on
     */
    idAttribute: 'id',

    /**
     * @property {String} nameAttribute the name attribute to operate on
     */
    nameAttribute: 'name',

    /**
     * @property {Object} [extraParams=undefined] extra query parameters to pass to the server
     */
    extraParams: {},

    /**
     * @property {String} apiURL the URL to the API endpoint
     */
    apiURL: null,

    /**
     * @property {Number} retrieveLimit adds a '&limit=' param to the AJAX request.
     * It also limits the number of search results allowed to be displayed in the results dropdown box
     */
    retrieveLimit: 10,

    /**
     * @property {Number} selectionLimit limits the number of selections that are allowed
     */
    selectionLimit: false,

    /**
     * @property {String} [queryParam=q] the name of the "search" query parameter
     */
    queryParam: 'q',

    /**
     * Auto escape all parameters in the parsed entities. Should be disabled only when applying a custom tempalte.
     * @type {Boolean}
     */
    escapeEntities: true,

    escape: escape,

    arbitrary: false,

    /**
     * height of the picker
     * @type {String|Function}
     */
    height: '150%',

    /**
     * Instead of display selected entity, publish an event by carrying the selected entity.
     *
     * @event 'change:{this.options.name}'
     * @type {Boolean}
     */
    autoSuggestMode: false,

    /**
     * black list of entities that won't be show up in the result panel.
     *
     * @type {Array|Function}
     */
    excludeIds: null,

    /**
     * To batch fetch data to prefill widget.
     * Otherwise it uses single request plus multiple `or` operators which may have limitation.
     * e.g. 20 when listing `/api/v1/user`
     *
     * @type {Number|Function}
     */
    batchFetchSize: 0,

    /**
     * Whenever model data is smaller than prefetch result in terms of size in edit mode,
     * implicitly update model data utilizing fetch result.
     *
     * @type {Boolean}
     */
    implicitSync: false,

    constructor: function (options) {
      /* eslint max-statements: [2, 22], complexity: [2, 8] */
      if (!this.apiURL) {
        throw new Error('apiURL not provided');
      }

      this.parse = _.wrap(this.parse, _.bind(function (parse, entity) {
        var target = parse.call(this, entity);
        return this.escapeEntities ? escapeEntity(target) : target;
      }, this));

      var params = this.getParams(options),
          idAttribute = _.resultCtx(params, 'idAttribute', this),
          extraParams = _.resultCtx(params, 'extraParams', this),
          nameAttribute = _.resultCtx(params, 'nameAttribute', this);

      if (idAttribute) {
        this.idAttribute = idAttribute;
      }
      if (extraParams) {
        this.extraParams = extraParams;
      }
      if (nameAttribute) {
        this.nameAttribute = nameAttribute;
      }

      _.defaults(this.events, events);
      BaseInput.call(this, options);

      var height = this.getAttribute('height');
      if (height) {
        this.$el.css({height: height});
      }

      this._entities = [];
      this._value = [];

      if (this.getAttribute('autoSuggestMode') === true) {
        this.addEntity = function ($el, entity) {
          this.getValuesInput().val(',');
          $el.remove();
          this.model.trigger('select:' + this.options.name, entity);
        };
      }

      // _.bindAll makes unit testing easier
      _.bindAll(this, 'addEntity', 'removeEntity', 'parseAll', 'resultsComplete');

      if (_.isFunction(this.formatList)) {
        _.bindAll(this, 'formatList');
      }
    },

    val: function () {
      return this._value;
    },

    focus: function () {
      _.defer(_.bind(function () {
        this.$('input[name="' + this.options.name + '"]').focus();
      }, this));
    },

    toStringValue: function () {
      return _.pluck(this._entities, this.nameAttribute).join(', ') || this.defaultValue();
    },

    readMode: function () {
      this.$el.empty();
      this.prefetch(_.bind(function (data) {
        this._entities = this.parseAll(data);
        this.$el.html(this.getReadModeString());
        this.model.trigger('form:resize');
      }, this));
    },

    editMode: function () {
      this.$el.empty();

      BaseInput.prototype.editMode.apply(this, arguments);
      this.widget = this._autoSuggest();
      this._prefill(this.widget);
    },

    /**
     * Launches the autoSuggest widget
     * @private
     * @return {Object}
     */
    _autoSuggest: function () {
      var options = {
        arbitrary: this.arbitrary,
        selectedItemProp: this.nameAttribute,
        selectedValuesProp: this.idAttribute,
        searchObjProps: this.nameAttribute,
        retrieveLimit: this.getParamOrAttribute('retrieveLimit'),
        selectionLimit: this.getParamOrAttribute('selectionLimit'),
        startText: this.options.placeholder,
        retrieveComplete: this.parseAll,
        selectionAdded: this.addEntity,
        selectionRemoved: this.removeEntity,
        formatList: this.formatList,
        queryParam: this.queryParam,
        resultsComplete: this.resultsComplete
      };

      if (this.extraParams && !_.isEmpty(this.extraParams)) {
        options.extraParams = '&' + $.param(this.extraParams);
      }
      var $input = this.$('input');
      $input.autoSuggest(this.apiURL, options);
      // Save a reference to autoSuggest's getValuesInput method that is added to an input wrapper.
      // It's used in GroupPicker when we want to clear the input when selection is happened (keepEmpty: true),
      // so the values_input value have to be set to "," in order to have placeholder displayed
      this.getValuesInput = $input.getValuesInput;
      return $input;
    },

    /**
     * @method formatList A custom formatter for the autoSuggest widget
     * @param {Object} entity the entity to present
     * @param {Object} el The jQuery element to decorate
     */
    formatList: undefined,

     /**
     * @method resultsComplete A custom function that is run when the suggestion results dropdown list is made visible.
     */
    resultsComplete: function () {},

    /**
     * Parses a list of raw entities (from the server payload)
     * The base implementation uses {@link BasePicker#parse} to parse each individual entity
     * @param  {Array} entities
     * @return {Array}
     */
    parseAll: function (entities) {
      var excludeIds = this.getAttribute('excludeIds'),
          xs;

      if (_.isArray(excludeIds) && !_.isEmpty(excludeIds)) {
        xs = _.filter(entities, function (entity) {
          return !_.contains(excludeIds, entity[this.getAttribute('idAttribute')]);
        }, this);
      } else {
        xs = entities;
      }

      return _.map(xs, this.parse, this);
    },

    /**
     * Pares an entity and normalize to an object we can later use in the widget
     * @param  {Object} entity
     * @return {Object}
     */
    parse: _.identity,

    getAttribute: function (name, defaultVal) {

      var locations = [this.options.params, this.options, this],
          total = locations.length,
          i = 0,
          val;

      for (; i < total; i++) {
        val = _.resultCtx(locations[i], name, this);
        if (!_.isUndefined(val)) {
          return val;
        }
      }

      return defaultVal;
    },

    /**
     * Prefill the widget with the saved data from the server.
     * We need to fetch the server in order to map ids to names
     *
     * @param {Object} widget The autocomplete widget
     * @private
     */
    _prefill: function (widget) {
      var self = this;
      this.disable();
      this.prefetch(function (data) {
        _.each(self.parseAll(data), function (entity) {
          self._entities.push(entity);
          widget.addInitialSelection(entity, entity[self.idAttribute]);
        });
        if (self.getAttribute('implicitSync') === true) {
          var ids = self.getModelValue();
          if (_.isArray(ids) && ids.length > self._entities.length) {
            self._value = _.map(self._entities, _.property(self.idAttribute));
            self.update();
          }
        }
        self.enable();
      }, _.bind(self.enable, self));
    },

    /**
     * Prefetch the existing values from the server (by IDs)
     * @param {Function} success The success callback function.
     * @param {Object} success.data The data returned by the API.
     * @param {Function} [error] The error callback function.
     */
    prefetch: function (success, error) {
      var ids = this.getModelValue();
      if (!ids || !ids.length) {
        success([]);
        return;
      }

      var xhr = this.batchFetch(ids);

      xhr.done(success);
      if (error) {
        xhr.fail(error);
      }
    },

    buildPrefetchQuery: function (ids) {
      return _.extend({}, this.extraParams, {
        filter: this.idAttribute + ' eq "' + ids.join('" or ' + this.idAttribute + ' eq "') + '"'
      });
    },

    batchFetch: function (ids) {
      return BatchAjaxUtil.getByIds({
        url: this.apiURL,
        batchSize: this.getAttribute('batchSize'),
        queryBuildFn: _.bind(this.buildPrefetchQuery, this),
        ids: ids
      });
    },

    /**
     * Add a single entity to the selection (and to the local registry)
     * This is called when the user selects an item from the dropdown.
     * @param {Object} $el a jQuery node
     * @param {Object} entity the parsed entity
     */
    addEntity: function ($el, entity) {
      var previousModelValue = this._getModelValueCloned();
      $el.attr('data-entity-id', entity[this.idAttribute]);
      this._updateModel(entity, true);
      this._resize();
      this._triggerChangeOnModel(previousModelValue);
    },

    /**
     * Removes an entity from the selection (and from the local registry)
     * @param  {Object} $el a jQuery node
     */
    removeEntity: function ($el) {
      var previousModelValue = this._getModelValueCloned();
      var search = {};
      search[this.idAttribute] = $el.data ? $el.data('entity-id') : $el;
      this._updateModel(_.findWhere(this._entities, search), false);
      $el.remove && $el.remove();
      this._resize();
      this._triggerChangeOnModel(previousModelValue);
    },

    /**
     * Returns clone of model value
     * @private
     */
    _getModelValueCloned: function () {
      return _.clone(this.getModelValue()) || [];
    },

    /**
     * Checks if the models value changed and triggers change event on the model.
     * @param {Array} previousModelValue is a list of entities from the model before the latest change
     * @private
     */
    _triggerChangeOnModel: function (previousModelValue) {
      var afterChange = this.getModelValue() || [];
      var common = _.intersection(afterChange, previousModelValue);
      var hasChanges = afterChange.length !== previousModelValue.length || common.length !== previousModelValue.length;
      if (hasChanges) {
        this.model.trigger('change:' + this.options.name);
      }
    },

    /**
     * Add or remove an entity from the model (and local registry)
     * @param  {Object} entity The entity to add or remove
     * @param  {Boolean} doAdd
     * @private
     */
    _updateModel: function (entity, doAdd) {
      var self = this;
      var modelValue = this.getModelValue() || [];
      //remove
      if (!doAdd && _.contains(modelValue, entity[self.idAttribute])) {
        // update model
        modelValue = _.reject(modelValue, function (id) {
          return id === entity[self.idAttribute];
        });
        // update local reference to full entity
        this._entities = _.reject(this._entities, function (item) {
          return item[self.idAttribute] === entity[self.idAttribute];
        });
      }
      // add
      else if (doAdd && !_.contains(modelValue, entity[self.idAttribute])) {
        modelValue.push(entity[self.idAttribute]);
        this._entities.push(entity);
      }
      this._value = modelValue;
      this.update();
    },

    /**
     * Triggers a resize event to update modal dialogs using this input
     * @private
     */
    _resize: _.debounce(function () {
      this.model.trigger('form:resize');
    }, 50)

  });

});
