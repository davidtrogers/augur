var constants = require('../libs/constants');
var utilities = require('../libs/utilities');

var NetworkActions = {

  /**
   * Update the UI and stores depending on the state of the network.
   *
   * If the daemon just became reachable (including startup), load the
   * latest data and ensure that we're monitoring new blocks to update our
   * stores. If our Ethereum daemon just became unreachable, dispatch an event so
   * an error dialog can be display.
   */
  checkNetwork: function () {
    var self = this;
    var network = this.flux.store('network').getState();
    augur.rpc.listening(function (nowUp) {
      var wasUp = (
        network.ethereumStatus === constants.network.ETHEREUM_STATUS_CONNECTED
      );
      var wasDown = (
        !network.ethereumStatus ||
        network.ethereumStatus === constants.network.ETHEREUM_STATUS_FAILED
      );
      if (!nowUp) {
        utilities.warn('failed to connect to ethereum');
        self.dispatch(constants.network.UPDATE_ETHEREUM_STATUS, {
          ethereumStatus: constants.network.ETHEREUM_STATUS_FAILED
        });
      } else if (wasDown && nowUp) {
        self.dispatch(constants.network.UPDATE_ETHEREUM_STATUS, {
          ethereumStatus: constants.network.ETHEREUM_STATUS_CONNECTED
        });
        self.flux.actions.config.setHost(
          augur.rpc.nodes.local || augur.rpc.nodes.hosted[0]
        );
        self.flux.actions.network.initializeNetwork();
        self.flux.actions.config.initializeData();
      }
      setTimeout(self.flux.actions.network.checkNetwork, 3000);
    });
  },

  initializeNetwork: function () {
    var self = this;

    // get network and client versions
    this.dispatch(constants.network.UPDATE_NETWORK, {
      networkId: augur.network_id
    });
    augur.rpc.clientVersion(function (clientVersion) {
      if (clientVersion && !clientVersion.error) {
        self.dispatch(constants.network.UPDATE_NETWORK, {
          clientVersion: clientVersion
        });
      }
    });

    // if available, use the client-side account
    if (augur.web.account.address && augur.web.account.privateKey) {
      console.log("using client-side account:", augur.web.account.address);
      this.dispatch(constants.config.UPDATE_ACCOUNT, {
        currentAccount: augur.web.account.address,
        privateKey: augur.web.account.privateKey,
        handle: augur.web.account.handle
      });
      this.flux.actions.asset.updateAssets();
      this.flux.actions.report.loadEventsToReport();
      this.flux.actions.report.loadPendingReports();
      if (this.flux.store("config").getState().useMarketCache) {
        this.flux.actions.market.loadMarketCache();
      }

    // hosted node: no unlocked account available
    } else if (this.flux.store('config').getState().isHosted) {
      console.log("no unlocked account available");
      this.dispatch(constants.network.UPDATE_ETHEREUM_STATUS, {
        ethereumStatus: constants.network.ETHEREUM_STATUS_NO_ACCOUNT
      });

    // local node: if it's unlocked, use the coinbase account
    } else {

      // check to make sure the account is unlocked
      augur.rpc.unlocked(augur.coinbase, function (unlocked) {

        // use coinbase if unlocked
        if (unlocked && !unlocked.error) {
          console.log("using unlocked account:", augur.coinbase);
          return self.dispatch(constants.config.UPDATE_ACCOUNT, {
            currentAccount: augur.coinbase
          });
        }

        // otherwise, no account available
        console.log("account", augur.coinbase, "is locked");
        self.dispatch(constants.network.UPDATE_ETHEREUM_STATUS, {
          ethereumStatus: constants.network.ETHEREUM_STATUS_NO_ACCOUNT
        });
      });
    }

    augur.rpc.gasPrice(function (gasPrice) {
      if (gasPrice && !gasPrice.error) {
        self.dispatch(constants.network.UPDATE_NETWORK, {
          gasPrice: utilities.formatEther(gasPrice)
        });
      }
    });

    this.flux.actions.network.updateNetwork();
  },

  updateNetwork: function () {
    var self = this;
    var configState = this.flux.store('config').getState();
    var networkState = this.flux.store('network').getState();
    var branchState = this.flux.store('branch').getState();

    // just block age and peer count until we're current
    augur.rpc.blockNumber(function (blockNumber) {

      if (blockNumber && !blockNumber.error) {

        blockNumber = abi.number(blockNumber);
        var blockMoment = utilities.blockToDate(blockNumber);

        self.dispatch(constants.network.UPDATE_NETWORK, {
          blockNumber: blockNumber,
          blocktime: blockMoment
        });

        augur.rpc.getBlock(blockNumber, true, function (block) {
          if (block && block.constructor === Object && !block.error) {

            var blockTimeStamp = block.timestamp;
            var currentTimeStamp = moment().unix();
            var age = currentTimeStamp - blockTimeStamp;

            self.dispatch(constants.network.UPDATE_BLOCK_CHAIN_AGE, {
              blockChainAge: age
            });
          }
        });
      }
    });

    augur.rpc.peerCount(function (peerCount) {

      if (peerCount && !peerCount.error) {
        self.dispatch(constants.network.UPDATE_NETWORK, {
          peerCount: abi.string(peerCount)
        });
      }
    });

    if (networkState.blockChainAge &&
        networkState.blockChainAge < constants.MAX_BLOCKCHAIN_AGE)
    {
      augur.rpc.mining(function (mining) {
        self.dispatch(constants.network.UPDATE_NETWORK, {
          mining: mining
        });
      });
      augur.rpc.hashrate(function (hashrate) {
        self.dispatch(constants.network.UPDATE_NETWORK, {
          hashrate: abi.number(hashrate)
        });
      });
    }
  }

};

module.exports = NetworkActions;
