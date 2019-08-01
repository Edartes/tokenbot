'use strict';

angular.module('copayApp.services').factory('addressbookService', function($log, bitcore, bitcoreCash, storageService, lodash, bitcoinCashJsService) {
  var root = {};

  var getNetwork = function(address) {
    var network;
    try {
      network = (new bitcore.Address(address)).network.name;
    } catch(e) {
      $log.warn('No valid bitcoin address. Trying bitcoin cash...');
      network = (new bitcoreCash.Address(address)).network.name;
    }
    return network;
  };

  root.get = function(addr, cb) {
    storageService.getAddressbook('testnet', function(err, ab) {
      if (err) return cb(err);
      if (ab) ab = JSON.parse(ab);
      if (ab && ab[addr]) return cb(null, ab[addr]);

      storageService.getAddressbook('livenet', function(err, ab) {
        if (err) return cb(err);
        if (ab) ab = JSON.parse(ab);
        if (ab && ab[addr]) return cb(null, ab[addr]);
        return cb();
      });
    });
  };

  root.list = function(cb) {
    storageService.getAddressbook('testnet', function(err, ab) {
      if (err) return cb('Could not get the Addressbook');

      if (ab) ab = JSON.parse(ab);

      ab = ab || {};
      storageService.getAddressbook('livenet', function(err, ab2) {
        if (ab2) ab2 = JSON.parse(ab2);

        ab2 = ab2 || {};
        return cb(err, lodash.defaults(ab2, ab));
      });
    });
  };

  root.add = function(entry, cb) {
    var network = getNetwork(entry.address);
    if (lodash.isEmpty(network)) return cb('Not valid bitcoin address');
    storageService.getAddressbook(network, function(err, ab) {
      if (err) return cb(err);
      if (ab) ab = JSON.parse(ab);
      ab = ab || {};
      if (lodash.isArray(ab)) ab = {}; // No array
      if (ab[entry.coin + entry.address]) return cb('Entry already exist');
      ab[entry.coin + entry.address] = entry;
      storageService.setAddressbook(network, JSON.stringify(ab), function(err, ab) {
        if (err) return cb('Error adding new entry');
        root.list(function(err, ab) {
          return cb(err, ab);
        });
      });
    });
  };

  root.remove = function(entry, cb) {
    
    // The entry is in bitcoin address, so I get the legacy one, and I operate.
    if (entry.coin == 'bch') {
      var a = entry.address;
      if (entry.address.indexOf('bitcoincash:') < 0) {
        a = 'bitcoincash:' + a;
      }
      entry.address = bitcoinCashJsService.readAddress(a).legacy;
    } else {
      entry.address = entry.address;
    }

    var network = getNetwork(entry.address);
    if (lodash.isEmpty(network)) return cb('Not valid bitcoin address');
    storageService.getAddressbook(network, function(err, ab) {
      if (err) return cb(err);
      if (ab) ab = JSON.parse(ab);
      ab = ab || {};
      if (lodash.isEmpty(ab)) return cb('Addressbook is empty');
      if (!ab[entry.coin + entry.address]) return cb('Entry does not exist');
      delete ab[entry.coin + entry.address];
      storageService.setAddressbook(network, JSON.stringify(ab), function(err) {
        if (err) return cb('Error deleting entry');
        root.list(function(err, ab) {
          return cb(err, ab);
        });
      });
    });
  };

  root.removeAll = function() {
    storageService.removeAddressbook('livenet', function(err) {
      storageService.removeAddressbook('testnet', function(err) {
        if (err) return cb('Error deleting addressbook');
        return cb();
      });
    });
  };

  return root;
});
