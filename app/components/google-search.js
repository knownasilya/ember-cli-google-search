import Ember from 'ember';
import observerThrottled from 'ember-cli-google-search/addon/utils/observer-throttled';

export default Ember.Component.extend({
  classNames: ['google-search', 'component'],
  placeholder: 'Search',
  inNavbar: false,
  itemControllerIndex: 0,
  selectedIndex: -1,

  initAutocomplete: function () {
    var $temp = Ember.$('<div/>');
    var service = new google.maps.places.AutocompleteService();
    var placesService = new google.maps.places.PlacesService($temp.get(0));

    this.setProperties({
      autoCompleteService: service,
      placesService: placesService
    });
  }.on('didInsertElement'),

  inputClass: function () {
    var large = this.get('large');

    return 'form-control' + (large ? ' input-lg' : '');
  }.property('large'),

  searchQueryChanged: observerThrottled('searchQuery', function () {
    var self = this;
    var searchQuery = this.get('searchQuery');
    var bounds = this.get('bounds');
    var service = this.get('autoCompleteService');

    if (!searchQuery || Ember.isEmpty(searchQuery) || !service) {
      this.set('searchResults', []);
      return;
    }

    service.getPlacePredictions({ input: searchQuery, bounds: bounds }, function (results, status) {
      if (status !== 'OK') {
        return;
      }

      self.set('selectedIndex', -1);
      Ember.RSVP.all(results.map(function (item) {
        return self.fetchResultDetails(item.place_id);
      }))
        .then(function (detailsResults) {
          var filtered = detailsResults.filter(function (result) {
            if (!result) {
              return false;
            }

            var ac = result.address_components;

            return result && result.geometry && bounds.contains(result.geometry.location)
              && ac.findBy('short_name', 'NY');
          });

          self.set('searchResults', filtered.map(function (item) {
            item.isSelected = false;
            item.address = item.formatted_address;
            return Ember.Object.create(item);
          }));
        });

    });
  }, 500, true),

  focusOut: function () {
    this.send('clearSelected');
  },

  keyDown: function (event) {
    if (!this.get('searchResults')) {
      return;
    }

    var lastSelected = this.get('lastSelected');
    var selectedIndex = this.get('selectedIndex');
    var searchResults = this.get('searchResults');
    var length = searchResults.get('length');
    var lastObject = searchResults.objectAt(selectedIndex);
    var newIndex, selectedObject;

    switch (event.keyCode) {
      // down key
      case 40: {
        if (selectedIndex === length - 1) {
          return;
        }

        newIndex = this.incrementProperty('selectedIndex');
        break;
      }

      // up key
      case 38: {
        if (selectedIndex === -1) {
          return;
        }

        newIndex = this.decrementProperty('selectedIndex');
        break;
      }

      // enter key
      case 13: {
        this.sendAction('selected', lastSelected);
        this.send('clearSelected');
        return;
      }

      // escape key
      case 27: {
        this.send('clearSelected');
        return;
      }

      default: {
          return;
      }
    }

    if (lastSelected) {
      lastSelected.set('isSelected', false);
    }

    if (event.keyCode === 40 || event.keyCode === 38) {
      selectedObject = searchResults.objectAt(newIndex);

      if (selectedObject) {
        selectedObject.toggleProperty('isSelected');
        this.set('lastSelected', selectedObject);
      }

      if (lastObject) {
        lastObject.set('isSelected', false);
      }
    }
  },

  actions: {
    select: function (item) {
      if (!item) {
        return;
      }

      this.sendAction('selected', item);
      this.send('clearSelected');
    },

    clearSelected: function (clearValue) {
      var lastSelected = this.get('lastSelected');

      if (lastSelected) {
        lastSelected.set('isSelected', false);
      }

      if (clearValue) {
        this.set('searchQuery', '');
      }

      this.setProperties({
        selectedIndex: -1,
        lastSelected: undefined,
        searchResults: []
      });
    }
  },

  fetchResultDetails: function (placeId) {
    var placesService = this.get('placesService');

    return new Ember.RSVP.Promise(function (resolve) {
      placesService.getDetails({ placeId: placeId }, function (details) {
        resolve(details);
      });
    });
  }
});
