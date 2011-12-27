/* Released under BSD license (see license.txt) */
/*
 * Copyright IBM Corporation 2010, 2010. All Rights Reserved. 
 * U.S. Government Users Restricted Rights -  Use, duplication or disclosure restricted by GSA ADP 
 * Schedule Contract with IBM Corp. 
 */


/**
 * DojoInfo side panel
 * @author preyna@ar.ibm.com
 * @author fergom@ar.ibm.com
 */
define([
        "firebug/firebug",
        "firebug/lib/dom",
        "firebug/lib/object",
        "firebug/lib/trace",
        "dojo/core/dojoaccess",
        "dojo/core/dojomodel",
        "dojo/ui/dojoreps",
        "dojo/ui/panels/panelCommons"
       ], function infoPanelsFactory(Firebug, Dom, Obj, FBTrace, DojoAccess, DojoModel, DojoReps, DojoPanels)
{

/**
 * @panel Info Side Panel.
 * This side panel shows general information about the dojo version and configuration use in the page. 
 */
var DojoInfoSidePanel = function() {};
DojoInfoSidePanel.prototype = Obj.extend(Firebug.Panel,
{
    name: "dojoInformationSidePanel",
    title: DojoPanels.$STR('panel.dojoInformationSidePanel.title'),
    parentPanel: DojoPanels.mainPanelName,
    order: 1,
    enableA11y: true,
    deriveA11yFrom: "console",
    editable: false,
    
    _COUTER_UPDATE_DELAY : 100,
    
    _connectionCounterId: "connectionCounterId",
    _subscriptionCounterId: "subscriptionCounterId",
    _widgetsCounterId: "widgetsCounterId",
    _onAspectObserverCounterId: "onAspectObserverCounterId",

    _getDojoInfo: function(context) {        
        var accessor = DojoPanels.getDojoAccessor(context);
        if(!accessor) {
            return;
        }
                
        return accessor.getDojoInfo(context);
    },

    initialize: function() {
        Firebug.Panel.initialize.apply(this, arguments);

        // Listeners registration for automatic connections and subscriptions counter.
        var ctx = DojoPanels._safeGetContext(this);
        var self = this;
        var eventsRegistrator = new DojoModel.EventListenerRegistrator(ctx.tracker);
        var connectionsCounterGetter = function() {
            if(!ctx.tracker) { return; } 
            self._updateCounter(this.connectionCounterNode, DojoModel.Connection.prototype.getGlobalConnectionsCount(ctx.tracker));
        };
        var subscriptionsCounterGetter = function() {
            if(!ctx.tracker) { return; }
            self._updateCounter(this.subscriptionCounterNode, DojoModel.Subscription.prototype.getGlobalSubscriptionsCount(ctx.tracker));            
        };
        //dojo 1.7+ only
        var onAspectCounterGetter = function() {
            if(!ctx.tracker) { return; } 
            self._updateCounter(this.onAspectCounterNode, DojoModel.OnAspectObserver.prototype.getGlobalOnAspectObserversCount(ctx.tracker));
        };        
        var widgetsCounterGetter = function() { 
            if(!DojoAccess.isInitialized(ctx)) { return; }
            self._updateCounter(this.widgetsCounterNode, DojoPanels.getDojoAccessor(ctx).getDijitRegistrySize(ctx)); 
        };

        //registers the listeners into model...
        eventsRegistrator.registerListenerForEvent(
                [DojoModel.Tracker.ON_CONNECTION_ADDED, DojoModel.Tracker.ON_CONNECTION_REMOVED], connectionsCounterGetter);
        eventsRegistrator.registerListenerForEvent(
                [DojoModel.Tracker.ON_SUBSCRIPTION_ADDED, DojoModel.Tracker.ON_SUBSCRIPTION_REMOVED], subscriptionsCounterGetter);
        eventsRegistrator.registerListenerForEvent(
                [DojoModel.Tracker.ON_CONNECTION_ADDED, DojoModel.Tracker.ON_CONNECTION_REMOVED], widgetsCounterGetter);
        //dojo 1.7+ only
        eventsRegistrator.registerListenerForEvent(
                [DojoModel.Tracker.ON_ONASPECTOBSERVER_ADDED, DojoModel.Tracker.ON_ONASPECTOBSERVER_REMOVED], onAspectCounterGetter);

        
        ctx.infoPanelCoutersRefreshEventsReg = eventsRegistrator;
        
        DojoPanels.addStyleSheet(this.document);
    },

    show: function(state) {
        var ctx = DojoPanels._safeGetContext(this);
        this.showInfo(ctx);
        if (ctx.infoPanelCoutersRefreshEventsReg){
            ctx.infoPanelCoutersRefreshEventsReg.setPropertyToListenersContext(
                    "connectionCounterNode", this._getCounterNode(this._connectionCounterId));
            ctx.infoPanelCoutersRefreshEventsReg.setPropertyToListenersContext(
                    "subscriptionCounterNode", this._getCounterNode(this._subscriptionCounterId));
            ctx.infoPanelCoutersRefreshEventsReg.setPropertyToListenersContext(
                    "onAspectCounterNode", this._getCounterNode(this._onAspectObserverCounterId));
            ctx.infoPanelCoutersRefreshEventsReg.setPropertyToListenersContext(
                    "widgetsCounterNode", this._getCounterNode(this._widgetsCounterId));
            ctx.infoPanelCoutersRefreshEventsReg.addAllListeners();
        }
    },
    
    hide: function(state) {
        var ctx = DojoPanels._safeGetContext(this);
        if (ctx.infoPanelCoutersRefreshEventsReg){
            ctx.infoPanelCoutersRefreshEventsReg.removeAllListeners();
        }
    },
    
    _getCounterNode: function(counterId){
        // FIXME: Use $() function. Find out why this.panelNode has no getElementById method. 
        var counters = this.panelNode.getElementsByClassName(counterId);
        return (counters.length > 0) ? counters[0] : null;//$('connectionCounterId', this.panelNode);
    },
    
    _updateCounter: function(counterNode, number) {
        if (counterNode) {
            counterNode.textContent = number;
        }
    },
    
    /**
     * added custom method (this one) instead of updateSelection to avoid changing the contents of
     * this panel when not needed.
     */
    showInfo: function(context) {
        var dojoInfo = this._getDojoInfo(context);
        
        if(!dojoInfo) {
            Dom.clearNode(this.panelNode);
            return;
        }

        var accessor = DojoPanels.getDojoAccessor(context);
        
        //Dojo version
        var versionLabel = DojoPanels.$STR('dojo.version.label');
        var versionObject = {};
        versionObject[versionLabel] = dojoInfo.version;
        Firebug.DOMPanel.DirTable.tag.replace({object: versionObject }, this.panelNode);
        
        //Dojo config
        Firebug.DOMPanel.DirTable.tag.append({object: dojoInfo.djConfig}, this.panelNode);

        //Module prefixes
        if(dojoInfo.modulePrefixes) {
            var modLabel = DojoPanels.$STR('dojo.modulesPrefixes.label');
            var modPrefixes = {};
            modPrefixes[modLabel] = dojoInfo.modulePrefixes;
            Firebug.DOMPanel.DirTable.tag.append({object: modPrefixes}, this.panelNode);
        }

        //Global connections count
        var globalConnectionsCount = (context.tracker) ? DojoModel.Connection.prototype.getGlobalConnectionsCount(context.tracker) : 0;       
        DojoReps.CounterLabel.tag.append({label: DojoPanels.$STR('conn.count.title'),
                                          object: globalConnectionsCount, 
                                          counterLabelClass:"countOfConnectionLabel",
                                          counterValueId: this._connectionCounterId}, this.panelNode);
        
        //Global subscriptions count
        var globalSubscriptionsCount = (context.tracker) ? DojoModel.Subscription.prototype.getGlobalSubscriptionsCount(context.tracker) : 0;        
        DojoReps.CounterLabel.tag.append({label: DojoPanels.$STR('subs.count.title'),
                                          object: globalSubscriptionsCount, 
                                          counterLabelClass:"countOfSubscriptionLabel",
                                          counterValueId: this._subscriptionCounterId}, this.panelNode);
       
        //Global OnAspectObserver count
        var globalOnAspectObserverCount = (context.tracker) ? DojoModel.OnAspectObserver.prototype.getGlobalOnAspectObserversCount(context.tracker) : 0;
        DojoReps.CounterLabel.tag.append({label: DojoPanels.$STR('OnAspectObserver.count.title'),
                                          object: globalOnAspectObserverCount, 
                                          counterLabelClass:"countOfOnAspectObserverLabel",
                                          counterValueId: this._onAspectObserverCounterId}, this.panelNode);

        //Widgets in registry count
        var widgetsCount = accessor ? accessor.getDijitRegistrySize(context) : 0;
        DojoReps.CounterLabel.tag.append({label: DojoPanels.$STR('widgets.count.title'),
                                          object: widgetsCount, 
                                          counterLabelClass:"countOfWidgetsLabel",
                                          counterValueId: this._widgetsCounterId}, this.panelNode);

    },
    
    refresh: function() {
        this.showInfo(DojoPanels._safeGetContext(this));
    },

    getOptionsMenuItems: function() {
        return [
            {label: DojoPanels.$STR('label.Refresh'), nol10n: true, command: Obj.bind(this.refresh, this) }
        ];
    }
    
});



//****************************************************************
//SIDE PANELS (END)
//****************************************************************
    
    
/***********************************************************************************************************************/

    // ***************************************************************
    // exported classes
    // ***************************************************************    

    DojoPanels.DojoInfoSidePanel = DojoInfoSidePanel;
    
    return DojoInfoSidePanel;
});
