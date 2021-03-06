var _ = require('lodash');
var React = require('react');
var Fluxxor = require("fluxxor");
var FluxMixin = Fluxxor.FluxMixin(React);
var StoreWatchMixin = Fluxxor.StoreWatchMixin;
var moment = require('moment');
var Paginate = require('react-paginate');
var Router = require('react-router');
var RouteHandler = Router.RouteHandler;
var Navigation = Router.Navigation;
var Link = Router.Link;

var AddMarketModal =  require('./AddMarketModal')
var Markets = require('./Markets');

var constants = require('../libs/constants');

var Branch = React.createClass({

  // assuming only one branch and all markets in store are of that branch
  mixins: [FluxMixin, StoreWatchMixin('market', 'branch', 'config'), Navigation],

  getInitialState: function() {
    return {
      addMarketModalOpen: false,
      marketsPerPage: constants.MARKETS_PER_PAGE,
      visiblePages: 3,
      pageNum: this.props.params.page ? this.props.params.page - 1 : 0
    };
  },

  getStateFromFlux: function () {

    var flux = this.getFlux();
    var marketState = flux.store('market').getState();
    var currentBranch = flux.store('branch').getCurrentBranch();
    var account = flux.store('config').getAccount();

    return {
      markets: marketState.markets,
      pendingMarkets: marketState.pendingMarkets,
      currentBranch: currentBranch,
      account: account
    }
  },

  toggleAddMarketModal: function(event) {

    this.setState({ addMarketModalOpen: !this.state.addMarketModalOpen });
  },

  handlePageChanged: function (data) {

    this.transitionTo('/markets/' + (parseInt(data.selected) + 1));
    this.setState({ pageNum: data.selected });
  },

  render: function () {

    var start = 0 + (this.state.pageNum) * this.state.marketsPerPage;
    var total = _.size(this.state.markets);
    var end = start + this.state.marketsPerPage;
    end = end > total ? total : end;
    //var marketPage = _.sortBy(this.state.markets, 'volume').reverse().slice(start, end);
    var marketPage = _.map(this.state.markets).slice(start, end);
    var submitMarketAction = (
      <span className="subheading pull-right">
        <a href="javascript:void(0);" onClick={ this.toggleAddMarketModal }>Submit a Market</a>
      </span>
    );
    if (!this.state.account) { 
      submitMarketAction = <span />;
    }

    var pendingMarkets = _.map(this.state.pendingMarkets);
    var pendingMarketsSection = <span />;
    if (this.state.pendingMarkets) {
      pendingMarketsSection = (
        <div className='pendingMarkets row'>
          <Markets 
            markets={ pendingMarkets }
            currentBranch={ this.state.currentBranch }
            classNameWrapper='col-sm-4' />
        </div>
      );
    }

    return (
      <div id="branch">
        { pendingMarketsSection }
        <h3 className="clearfix">Markets { submitMarketAction }</h3>
        <div className='subheading clearfix'>
          <span className='showing'>Showing { start+1 } - { end } of { total }</span>
          <Paginate 
            previousLabel={ <i className='fa fa-chevron-left'></i> }
            nextLabel={ <i className='fa fa-chevron-right'></i> }
            breakLabel={ <li className="break"><a href="">...</a></li> }
            pageNum={ total / this.state.marketsPerPage }
            marginPagesDisplayed={ 2 }
            pageRangeDisplayed={ 5 }
            initialSelected={ this.state.pageNum }
            clickCallback={ this.handlePageChanged }
            containerClassName={ 'paginator' }
            subContainerClassName={ 'pages' }
            activeClass={ 'active' } 
          />
        </div>
        <div className='markets row'>
          <Markets 
            markets={ marketPage }
            currentBranch={ this.state.currentBranch }
            classNameWrapper='col-sm-4' />
        </div>

        <AddMarketModal show={ this.state.addMarketModalOpen } onHide={ this.toggleAddMarketModal } />
      </div>
    );
  }
});

module.exports = Branch;
