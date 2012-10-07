/* Released under BSD license (see license.txt) */
/*
 * Copyright IBM Corporation 2010, 2010. All Rights Reserved. 
 * U.S. Government Users Restricted Rights -  Use, duplication or disclosure restricted by GSA ADP 
 * Schedule Contract with IBM Corp. 
 */


/**
 * The main panel (UI) of this extension
 * @author preyna@ar.ibm.com
 * @author fergom@ar.ibm.com
 */
define([
        "firebug/firebug",
        "firebug/lib/xpcom",
        "firebug/lib/css",
        "firebug/lib/json",
        "firebug/lib/locale",
        "firebug/lib/object",
        "firebug/lib/search",
        "firebug/lib/string",
        "firebug/lib/trace",
        "dojo/core/dojofirebugextension",
        "dojo/core/dojomodel",
        "dojo/core/prefs",
        "dojo/lib/collections",
        "dojo/ui/dojoreps",
        "dojo/ui/ui",
        "dojo/ui/messageBox",
        "dojo/ui/uihelpers",        
        "dojo/ui/panels/connectionsSidePanel",
        "dojo/ui/panels/dojoInfoSidePanel",
        "dojo/ui/panels/domSidePanel",
        "dojo/ui/panels/htmlSidePanel",        
        "dojo/ui/panels/onAspectSidePanel",
        "dojo/ui/panels/panelCommons",
        "dojo/ui/panels/subscriptionsSidePanel",
        "dojo/ui/panels/widgetPropertiesSidePanel"
       ], function dojoPanelsFactory(Firebug, Xpcom, Css, Json, Locale, Obj, Search, Str, FBTrace, DojoExtension, 
               DojoModel, DojoPrefs, Collections, DojoReps, UI, MessageBox, UiHelpers, ConnectionsSidePanel, DojoInfoSidePanel, DomSidePanel, HtmlSidePanel, 
               OnAspectSidePanel, DojoPanels, SubscriptionsSidePanel, WidgetPropertiesSidePanel)
{

    //FIXME refactor this file into smaller ones

    
 // ****************************************************************
    
    var getDojoAccessor = function(context) {
        return DojoPanels.getDojoAccessor(context);
    };

    var getDojoDebugger = function(context) {
        return DojoPanels.getDojoDebugger(context);
    };
    
    /*context*/var _safeGetContext = function(panel) {
        return DojoPanels._safeGetContext(panel);
    };


    
    /**
     * Configuration for panel rendering. This object is used by the "updatePanelView" method
     * It basically dictates "what to refresh" in the UI
     */
    var PanelRenderConfig = function(/*boolean*/ refreshMainPanel, /*PanelView*/mainPanelView,
                                     /*boolean*/ highlight, /*boolean*/ scroll,
                                     /*boolean*/ refreshSidePanel, /*String*/sidePanelView){
        this.refreshMainPanel = refreshMainPanel;
        this.mainPanelView = mainPanelView;
        this.highlight = highlight;
        this.scroll = scroll;
        this.refreshSidePanel = refreshSidePanel;
        this.sidePanelView = sidePanelView;
        
        /**
         * Verify if the parameter view is the selected one.
         */
        this.isViewSelected = function(view){
            return (this.mainPanelView == view);
        };
    };
    PanelRenderConfig.VIEW_WIDGETS = "view_widgets";
    PanelRenderConfig.VIEW_CONNECTIONS = "view_connections";
    PanelRenderConfig.VIEW_SUBSCRIPTIONS = "view_subscriptions";
    PanelRenderConfig.VIEW_ONASPECTS = "view_onAspectObservers";
    
    

// ****************************************************************
// MAIN PANEL
// ****************************************************************

var SHOW_WIDGETS = 10;
//var SHOW_CONNECTIONS = 20;
var SHOW_CONNECTIONS_TABLE = 30;
var SHOW_SUBSCRIPTIONS = 40;
var SHOW_ONASPECTS_TABLE = 50;

/**
 * @panel Main dojo extension panel
 */
var dojofirebugextensionPanel = function() {};
dojofirebugextensionPanel.prototype = Obj.extend(DojoPanels.ActivablePanelPlusMixin,
{    
    name: DojoPanels.mainPanelName,

    title: DojoPanels.$STR('panel.dojofirebugextensionPanel.title'),
    
    searchable: true,
    inspectable: true,
    inspectHighlightColor: "green",
    editable: false,

    /**
     * @override
     */
    initialize: function(context, doc) {
        Firebug.ActivablePanel.initialize.apply(this, arguments);
                
        if(context.dojo && !context.dojo.mainMenuSelectedOption) { 
            context.dojo.mainMenuSelectedOption = SHOW_WIDGETS;            
        }
        
        this._initHighlighter(context);
                
        this._initMessageBoxes(context);
        
        DojoPanels.addStyleSheet(this.document);
    },

    destroy: function(state) {
        if (FBTrace.DBG_DOJO)
            FBTrace.sysout("DOJO; Dojo mainPanel.destroy");

        //super's destroy must be last sentence.
        Firebug.ActivablePanel.destroy.apply(this, arguments);
    },
    
    _initMessageBoxes: function(ctx) {
        // Message boxes
        var self = this;
       
        /* Message box for connections */
        var conMsgBox = this.connectionsMessageBox = new MessageBox.ActionMessageBox("connectionsMsgBox", this.panelNode, 
                                                            DojoPanels.$STR('warning.newConnectionsMade'),
                                                            DojoPanels.$STR('warning.newConnectionsMade.button.update'),
                                                            function(actionMessageBox) {
                                                                actionMessageBox.hideMessageBox();
                                                                self.showConnectionsInTable(ctx);
                                                            });
        
        var showConnectionsMessageBox = function() { conMsgBox.showMessageBox(); };
        ctx.tracker.addListener(DojoModel.Tracker.ON_CONNECTION_ADDED, showConnectionsMessageBox);
        ctx.tracker.addListener(DojoModel.Tracker.ON_CONNECTION_REMOVED, showConnectionsMessageBox);
        
        /* Message box for subscriptions */
        var subMsgBox = this.subscriptionsMessageBox = new MessageBox.ActionMessageBox("subscriptionsMsgBox", this.panelNode, 
                DojoPanels.$STR('warning.newSubscriptionsMade'),
                DojoPanels.$STR('warning.newSubscriptionsMade.button.update'),
                function(subscriptionMsgBox){
                    subscriptionMsgBox.hideMessageBox();
                    self.showSubscriptions(ctx);
                });
        var showSubscriptionsMessageBox = function() { subMsgBox.showMessageBox(); };
        ctx.tracker.addListener(DojoModel.Tracker.ON_SUBSCRIPTION_ADDED, showSubscriptionsMessageBox);
        ctx.tracker.addListener(DojoModel.Tracker.ON_SUBSCRIPTION_REMOVED, showSubscriptionsMessageBox);

        /* Message box for on/aspects */
        var onAspectsMsgBox = this.onAspectObserversMessageBox = new MessageBox.ActionMessageBox("onAspectObserversMsgBox", this.panelNode, 
                                                            DojoPanels.$STR('warning.newOnAspectMade'),
                                                            DojoPanels.$STR('warning.newOnAspectMade.button.update'),
                                                            function(actionMessageBox) {
                                                                actionMessageBox.hideMessageBox();
                                                                self.showOnAspectObserversInTable(ctx);
                                                            });
        
        var showOnAspectObserversMessageBox = function() { onAspectsMsgBox.showMessageBox(); };
        ctx.tracker.addListener(DojoModel.Tracker.ON_ONASPECTOBSERVER_ADDED, showOnAspectObserversMessageBox);
        ctx.tracker.addListener(DojoModel.Tracker.ON_ONASPECTOBSERVER_REMOVED, showOnAspectObserversMessageBox);

    },
    
    _initHighlighter: function(context) {
  
        this._domHighlightSelector = new UiHelpers.DomHighlightSelector();
        
        this._domHighlightSelector.addSelector("dojo-connection", function(selection, connection) {
            var usingHashcodes = DojoPrefs._isHashCodeBasedDictionaryImplementationEnabled();
            return connection && ((Collections.areEqual(connection['obj'], selection, usingHashcodes)) || (Collections.areEqual(connection['context'], selection, usingHashcodes)));
        });
        
        this._domHighlightSelector.addSelector("dojo-subscription", function(selection, subscription) {
            var usingHashcodes = DojoPrefs._isHashCodeBasedDictionaryImplementationEnabled();
            return subscription && (Collections.areEqual(subscription['context'], selection, usingHashcodes));
        });

        this._domHighlightSelector.addSelector("dojo-onaspectobserver", function(selection, observer) {
            var usingHashcodes = DojoPrefs._isHashCodeBasedDictionaryImplementationEnabled();
            return observer && (Collections.areEqual(observer['target'], selection, usingHashcodes));
        });

        this._domHighlightSelector.addSelector("dojo-widget", function(selection, widget) {
            var usingHashcodes = DojoPrefs._isHashCodeBasedDictionaryImplementationEnabled();
            return Collections.areEqual(widget, selection, usingHashcodes);
        });        
    },
    
    // **********  Inspector related methods ************************
    
    _configureInspectorSupport: function(/*bool*/on) {
        
        this.inspectable = on;        
    },
    
    /**
     * Highlight a node using the frame highlighter.
     * Overridden here to avoid changing dojo extension panel contents all the time.  
     * @param {Element} node The element to inspect
     */
    inspectNode: function(node) {
        return false;
    },
    
    stopInspecting: function(node, canceled) {
        if (canceled) {
            return;
        }

        this.select(node);        
    },
    
    // **********  end of Inspector related methods ************************
    
    /**
     * @state: persistedPanelState plus non-persisted hide() values 
     * @override
     */
    show: function(state) {
        Firebug.ActivablePanel.show.apply(this, arguments);

        //show our toolbar
        this.showToolbarButtons("fbDojo_firebugextensionButtons", true);        
        // Sync the selected toolbar button with the selected view.
        var ctx = _safeGetContext(this);
        this._setOption(ctx.dojo.mainMenuSelectedOption, ctx);
    },
    
    /**
     * This method shows the first view for a loaded page.
     */
    showInitialView: function(context) {
        var hasWidgets = this.hasWidgets(context);
        var connsAPI = context.tracker;
        
        if (hasWidgets) {
            this.showWidgets(context);            
        } else if (connsAPI && DojoModel.Connection.prototype.getGlobalConnectionsCount(connsAPI) > 0) {
            this.showConnectionsInTable(context);
        } else if (connsAPI && DojoModel.Subscription.prototype.getGlobalSubscriptionsCount(connsAPI) > 0) {
            this.showSubscriptions(context);
        } else if (connsAPI && DojoModel.OnAspectObserver.prototype.getGlobalOnAspectObserversCount(connsAPI) > 0) {
            this.showOnAspectObserversInTable(context);
        } else { //Default
            this.showWidgets(context);
        }
        
        //show UI of selected side panel
        var sidePanel = Firebug.chrome.getSelectedSidePanel();
        if(sidePanel) {
            sidePanel.refresh();   
        }
    },

    /**
     * Refresh the panel.
     * @override
     */
     refresh: function() {
         var context = _safeGetContext(this);
                  
         // Select the current main view.
         if(this._isOptionSelected(SHOW_WIDGETS, context)) {
             this.showWidgets(context);
         } else if(this._isOptionSelected(SHOW_CONNECTIONS_TABLE, context)) {
             this.showConnectionsInTable(context);
         } else if(this._isOptionSelected(SHOW_ONASPECTS_TABLE, context)) {
             this.showOnAspectObserversInTable(context);             
         } else if(this._isOptionSelected(SHOW_SUBSCRIPTIONS, context)) {
             this.showSubscriptions(context); 
        }
     },
    
    /**
     * Returns a number indicating the view's ability to inspect the object.
     * Zero means not supported, and higher numbers indicate specificity.
     * @override
     */
    supportsObject: function(object, type) {
        if(FBTrace.DBG_DOJO) {
            FBTrace.sysout("DOJO MAIN - supportsObject? ", object);
        }

        var context = _safeGetContext(this);
        var support = this.supportsActualObject(context, object, type);
        
        if(support == 0) {
            support = this.doesNodeBelongToWidget(context, object, type);
        }

        if(FBTrace.DBG_DOJO) {
            FBTrace.sysout("DOJO MAIN - supportsObject result:" + support);
        }

        return support;
    },
    
    
    /**
     * Support verification for actual object
     */
    supportsActualObject: function(context, object, type) {
        var dojoAccessor = getDojoAccessor(context);
        if (dojoAccessor.isWidgetObject(object)){
            return 1;
        }
        
        //delegate to side panels...
        return (this._isConnection(object, type) || this._isSubscription(object, type) || this._isOnAspectObserver(object, type)) ? 1 : 0;
    },

    /**
     * Support verification for a potential widget that contains the node.
     */
    /*int: 0|1*/doesNodeBelongToWidget: function(context, object, type) {
        var dojoAccessor = getDojoAccessor(context);
        var widget = dojoAccessor.getEnclosingWidget(context, object);
        return widget ? 1 : 0;
    },
    
    /**
     * returns whether the given object is a connection.
     * @param obj the obj to check
     * @param type optional
     */
    _isConnection: function(obj, type) {
        if(!obj) {
            return false;
        }
        return DojoPanels.ConnectionsSidePanel.prototype.supportsObject(obj, type) > 0;
    },

    /**
     * returns whether the given object is a connection.
     * @param obj the obj to check
     * @param type optional
     */
    _isSubscription: function(obj, type) {
        if(!obj) {
            return false;
        }
        return DojoPanels.SubscriptionsSidePanel.prototype.supportsObject(obj, type) > 0;
    },

    /**
     * returns whether the given object is a ON event or an aspect.
     * @param obj the obj to check
     * @param type optional
     */
    _isOnAspectObserver: function(obj, type) {
        if(!obj) {
            return false;
        }
        return DojoPanels.OnAspectSidePanel.prototype.supportsObject(obj, type) > 0;
    },

    /**
     * Return the path of selections shown in the extension toolbar.
     * @override
     */
    getObjectPath: function(object) {
         return [object];
    },
    
    /**
     * Highlight the found row.
     */
    highlightRow: function(row) {
        if (this.highlightedRow) {
            Css.cancelClassTimed(this.highlightedRow, "jumpHighlight", this.context);
        }

        this.highlightedRow = row;

        if (row){
            Css.setClassTimed(row, "jumpHighlight", this.context);
        }
    },
    
    /**
     * Panel search.
     * @override
     */
    search: function(text, reverse) {
        if (!text) {
            delete this.currentSearch;
            this.highlightRow(null);
            this.document.defaultView.getSelection().removeAllRanges();
            return false;
        }

        var row;
        if (this.currentSearch && text == this.currentSearch.text) {
            row = this.currentSearch.findNext(true, false, reverse, Firebug.Search.isCaseSensitive(text));
        } else {
            this.currentSearch = new Search.TextSearch(this.panelNode);
            row = this.currentSearch.find(text, reverse, Firebug.Search.isCaseSensitive(text));
        }

        if (row) {
            var sel = this.document.defaultView.getSelection();
            sel.removeAllRanges();
            sel.addRange(this.currentSearch.range);

            UiHelpers.scrollSelectionIntoView(this);
            this.highlightRow(row);

            return true;
        } else {
            this.document.defaultView.getSelection().removeAllRanges();
            return false;
        }
        
    },
    
    _showReloadBoxIfNeeded: function(context) { 
        // Verify if the context is consistent.
        if (DojoExtension.needsReload(context)) {
            /* Message box for Reload page */
            var conMsgBox = new MessageBox.ActionMessageBox("MsgBox", this.panelNode, 
                                                            DojoPanels.$STR('warning.pageNeedToBeReload'),
                                                            DojoPanels.$STR('warning.pageNeedToBeReload.button'),
                                                            function(actionMessageBox){
                                                                Firebug.currentContext.window.location.reload();
                                                            });
            conMsgBox.loadMessageBox(true);
        }
    },
    
    _showEnableRequiredPanels: function(context) { 
        if (context.dojoPanelReqsNotMet) {
            var console = Firebug.getPanelTitle(Firebug.getPanelType("console"));
            var script = Firebug.getPanelTitle(Firebug.getPanelType("script"));
            var enablePanelsMsgBox = new MessageBox.ActionMessageBox("EnablePanelsMsgBox", this.panelNode, 
                                                            DojoPanels.$STRF('warning.panelsNeedToBeEnabled', [console, script]),
                                                            DojoPanels.$STR('warning.panelsNeedToBeEnabled.button'),
                                                            function(actionMessageBox){
                                                                //nothing to do
                                                            });
            enablePanelsMsgBox.loadMessageBox(true);
        }
    },
    
    /**
     * Update panel view. Main "render" panel method
     * @param panelConfig the configuration
     * @param context the FB context
     */
    updatePanelView: function(/*PanelRenderConfig*/panelConfig, context){
        var selection = context.dojoExtensionSelection;
        var dojoAccessor = getDojoAccessor(context);
        
        //enable inspector based on widget existence
        this._configureInspectorSupport(this.hasWidgets(context));        

        
        //1st step: draw Main panel view.
        if (panelConfig.refreshMainPanel){
            // Clear the main panel
            this.panelNode.innerHTML = "";
             
            // Verify if the context is consistent.
            this._showReloadBoxIfNeeded(context);
            this._showEnableRequiredPanels(context);
            
            // Select the most suitable main panel to show the info about the selection
            
            if (panelConfig.isViewSelected(PanelRenderConfig.VIEW_WIDGETS) || 
                (!panelConfig.mainPanelView && dojoAccessor.isWidgetObject(selection))) {
                this._renderWidgets(context);
                
            } else if (panelConfig.isViewSelected(PanelRenderConfig.VIEW_CONNECTIONS) ||
                (!panelConfig.mainPanelView && this._isConnection(selection))) {
                this._renderConnectionsInTable(context);
            
            } else if (panelConfig.isViewSelected(PanelRenderConfig.VIEW_SUBSCRIPTIONS) || 
                (!panelConfig.mainPanelView && this._isSubscription(selection))) {
                this._renderSubscriptions(context);

            } else if (panelConfig.isViewSelected(PanelRenderConfig.VIEW_ONASPECTS) || 
                    (!panelConfig.mainPanelView && this._isOnAspectObserver(selection))) {
                    this._renderOnAspectObserversInTable(context);
                
            } else {
                //if no other option...
                this._renderWidgets(context);
            }
        }
        
        // 2nd step: Highlight and Scroll the selection in the current view.
        this.highlightSelection(selection, panelConfig.highlight, panelConfig.scroll);
        
        // 3rd step: draw Side panel view
        if (panelConfig.refreshSidePanel) {
            var sidePanel = null;
            if (panelConfig.sidePanelView) {
                Firebug.chrome.selectSidePanel(panelConfig.sidePanelView);
            } else {
                // Select the most suitable side panel to show the info about the selection.
                if (this._isConnection(selection)) {
                    Firebug.chrome.selectSidePanel(DojoPanels.ConnectionsSidePanel.prototype.name);
                } else if(this._isSubscription(selection)){
                    Firebug.chrome.selectSidePanel(DojoPanels.SubscriptionsSidePanel.prototype.name);
                } else if(this._isOnAspectObserver(selection)){
                    Firebug.chrome.selectSidePanel(DojoPanels.OnAspectSidePanel.prototype.name);
                } else {
                    //default
                    Firebug.chrome.selectSidePanel(DojoPanels.DojoInfoSidePanel.prototype.name);
                }
            }
        }
    },
    
    /**
     * Firebug wants to show an object to the user and this panel has the best supportsObject() result for the object.
     * Should we also focus now a side panel?
     * @override
     */
    updateSelection: function(object) {
        var ctx = _safeGetContext(this);
        if (this.supportsActualObject(ctx, object) == 0) {
            var dojoAccessor = getDojoAccessor(ctx);
            var widget = dojoAccessor.getEnclosingWidget(ctx, object);
            if(!widget) {
                return;
            }
            this.select(widget);

        } else {
        
            Firebug.ActivablePanel.updateSelection.call(this, object);
            
            if (!ctx.sidePanelSelectionConfig) {
                this.updatePanelView(new PanelRenderConfig(/*refreshMainPanel*/true, /*mainPanelView*/null, /*highlight*/true, /*scroll*/true,
                                                           /*refreshSidePanel*/true, /*sidePanelView*/null), ctx);
            } else {
                this.updatePanelView(ctx.sidePanelSelectionConfig, ctx);
            }        

        }
    },
    
    /**
     * This method highlight the selection in the main panel.
     * @param selection the selection.
     * @param focus boolean to decide if the object should be focus
     */
    highlightSelection : function(selection, /*boolean*/focus) {
        this._domHighlightSelector.highlightSelection(this.panelNode, selection, focus);
    },
    
    /**
     * This method show the object in the Connection sidePanel.
     * @param object the object to show
     */
    showObjectInConnectionSidePanel : function(object){
        this.updateSelectionAndSelectSidePanel(object, DojoPanels.ConnectionsSidePanel.prototype.name);
    },
    
    /**
     * This method show the object in the Subscription sidePanel.
     * @param object the object to show
     */
    showObjectInSubscriptionSidePanel : function(object){
        this.updateSelectionAndSelectSidePanel(object, DojoPanels.SubscriptionsSidePanel.prototype.name);
    },

    /**
     * This method show the object in the On/Aspects sidePanel.
     * @param object the object to show
     */
    showObjectInOnAspectsSidePanel : function(object){
        this.updateSelectionAndSelectSidePanel(object, DojoPanels.OnAspectSidePanel.prototype.name);
    },

    /**
     * This method show the object in the sidePanelName without changing the dojo main panel
     * @param object the object to show
     * @param sidePanelName the side panel where the object should be shown
     */
    updateSelectionAndSelectSidePanel : function(object, sidePanelName){
        var ctx = _safeGetContext(this);
        
        // Set in the context the render configurations.
        ctx.sidePanelSelectionConfig = new PanelRenderConfig(/*refreshMainPanel*/false, /*mainPanelView*/null, /*highlight*/false, /*scroll*/false,
                                                             /*refreshSidePanel*/true, /*sidePanelView*/sidePanelName);
        Firebug.chrome.select(object, this.name, sidePanelName, true);
        // Clean from the context the render configurations.
        ctx.sidePanelSelectionConfig = null;
    },
    
    /**
     * The select method is extended to force the panel update always.
     * @override 
     */
    select: function(object, forceUpdate) {
        _safeGetContext(this).dojoExtensionSelection = object;
        DojoPanels.ActivablePanelPlusMixin.select.call(this, object, true);
    },    
    
    /**
     *  returns true is the given option is selected on this context
     */
    /*boolean*/_isOptionSelected: function(option, ctx) {
        if(!ctx.dojo) {
            return false;
        }
        return (ctx.dojo.mainMenuSelectedOption) && (ctx.dojo.mainMenuSelectedOption === option); 
    },
    
    _setOption: function(option, ctx) {
        ctx.dojo.mainMenuSelectedOption = option;
        
        var doc = this.panelNode.document;
        Firebug.chrome.$("fbDojo_widgetsButton", doc).checked = (option == SHOW_WIDGETS);
        Firebug.chrome.$("fbDojo_connectionsInTableButton", doc).checked = (option == SHOW_CONNECTIONS_TABLE);
        Firebug.chrome.$("fbDojo_dojoFilter-boxes", doc).style.display = UI.getVisibilityValue(option == SHOW_CONNECTIONS_TABLE);
        Firebug.chrome.$("fbDojo_subscriptionsButton", doc).checked = (option == SHOW_SUBSCRIPTIONS);
        Firebug.chrome.$("fbDojo_onAspectObserversButton", doc).checked = (option == SHOW_ONASPECTS_TABLE);
    },
        
    /**
     * returns panel's main menu items
     * @override
     */
    getOptionsMenuItems: function() {
        // {label: 'name', nol10n: true,  type: "checkbox", checked: <value>, command:function to set <value>}
        
        var context = _safeGetContext(this);
        return [
                { label: DojoPanels.$STR('label.Widgets'), name: 'dojoMainPanelOptions', nol10n: true, type: 'radio', checked: this._isOptionSelected(SHOW_WIDGETS, context), command: Obj.bindFixed(this.showWidgets, this, context)  },
                { label: DojoPanels.$STR('label.Connections'), name: 'dojoMainPanelOptions', nol10n: true, type: 'radio', checked: this._isOptionSelected(SHOW_CONNECTIONS_TABLE, context), command: Obj.bindFixed(this.showConnectionsInTable, this, context)  },
                { label: DojoPanels.$STR('label.Subscriptions'), name: 'dojoMainPanelOptions', nol10n: true, type: 'radio', checked: this._isOptionSelected(SHOW_SUBSCRIPTIONS, context), command: Obj.bindFixed(this.showSubscriptions, this, context)  },
                { label: DojoPanels.$STR('label.OnAspectObservers'), name: 'dojoMainPanelOptions', nol10n: true, type: 'radio', checked: this._isOptionSelected(SHOW_ONASPECTS_TABLE, context), command: Obj.bindFixed(this.showOnAspectObserversInTable, this, context)  },
                "-",
                { label: DojoPanels.$STR('label.BreakPointPlaceEnable'), nol10n: true, type: 'checkbox', disabled: DojoPrefs._isUseEventBasedProxyEnabled(), checked: !DojoPrefs._isBreakPointPlaceSupportDisabled(), command: Obj.bindFixed(this._switchConfigurationSetting, this, DojoPrefs._switchBreakPointPlaceEnabled, context) },
                "-",
                { label: DojoPanels.$STR('label.WidgetsTreeEnabled'), nol10n: true, type: 'checkbox', disabled: false, checked: DojoPrefs._isWidgetsTreeEnabled(), command: Obj.bindFixed(this._switchWidgetsTreeMode, this, context) },                
                "-",
                { label: DojoPanels.$STR('label.About'), nol10n: true, command: Obj.bindFixed(this.showAbout, this) },
                "-",
                { label: DojoPanels.$STR('label.Refresh'), nol10n: true, command: Obj.bindFixed(this.refresh, this) }
        ];
    },

    _switchConfigurationSetting: function(switchSettingFn, context) {
        switchSettingFn.apply(this);
        DojoExtension.setNeedsReload(context, true);
        this.refresh();
    },
    
    showAbout: function() {
        this.openAboutDialog();
    },

    openAboutDialog: function() {
        if (FBTrace.DBG_WINDOWS) {
            FBTrace.sysout("dojofirebugextension.openAboutDialog");
        }

        try
        {
            // Firefox 4.0 implements new AddonManager. In case of Firefox 3.6 the module
            // is not avaialble and there is an exception.
            Components.utils.import("resource://gre/modules/AddonManager.jsm");
        }
        catch (err)
        {
        }

        if (typeof(AddonManager) != "undefined")
        {
            AddonManager.getAddonByID("dojo@silvergate.ar.ibm.com", function(addon) {
                openDialog("chrome://mozapps/content/extensions/about.xul", "",
                "chrome,centerscreen,modal", addon);
            });
        }
        else
        {
            var extensionManager = Xpcom.CCSV("@mozilla.org/extensions/manager;1",
                "nsIExtensionManager");

            openDialog("chrome://mozapps/content/extensions/about.xul", "",
                "chrome,centerscreen,modal", "urn:mozilla:item:dojo@silvergate.ar.ibm.com",
                extensionManager.datasource);
        }
    },
    
    /**
     * returns current page's widgets
     */
    /*array*/getWidgets: function(context) {        
        var accessor = getDojoAccessor(context);
        if(!accessor) {
            return [];
        }
        
        return accessor.getWidgets(context);
    },

    /*boolean*/hasWidgets: function(context) {
        var accessor = getDojoAccessor(context);
        if(!accessor) {
            return false;
        }
        return accessor.hasWidgets(context);        
    }, 
    
    /**
     * returns current page's widgets
     */
    /*array*/getWidgetsRoots: function(context) {

        var accessor = getDojoAccessor(context);
        if(!accessor) {
            return [];
        }
        return accessor.getWidgetsRoots(context);
    },

    _switchWidgetsTreeMode: function(context) {
        DojoPrefs._switchWidgetsTreeEnabled();
         if(this._isOptionSelected(SHOW_WIDGETS, context)) {
             this.refresh();
         }
        
    },
    
    /**
     * Show the widget list.
     */
    showWidgets: function(context) {
        this.updatePanelView(
                new PanelRenderConfig(/*refreshMainPanel*/true, /*mainPanelView*/PanelRenderConfig.VIEW_WIDGETS, /*highlight*/true, /*scroll*/true,
                                      /*refreshSidePanel*/false, /*sidePanelView*/null), context);
    },
        
    /**
     * Render the Widget list view
     * !Do not invoke this method directly. It must be just invoked from the updatePanelView method.
     */
    _renderWidgets: function(context) {
        this._setOption(SHOW_WIDGETS, context);
        
        var useWidgetTree = DojoPrefs._isWidgetsTreeEnabled();
        
        var widgets = (useWidgetTree) ? this.getWidgetsRoots(context) : this.getWidgets(context);

        var areThereAnyWidgets = widgets.length > 0; 
        if(!areThereAnyWidgets) {
            MessageBox.Messages.infoTag.append({object: DojoPanels.$STR('warning.nowidgets.msg1')}, this.panelNode);
            MessageBox.Messages.simpleTag.append({object: DojoPanels.$STR("warning.nowidgets.msg2")}, this.panelNode);
            return areThereAnyWidgets;
        }
        
        var dojoAccessor = getDojoAccessor(context);
        var fnGetHighLevelProps = dojoAccessor.getSpecificWidgetProperties;        
        var funcWidgetProperties = Obj.bind(fnGetHighLevelProps, dojoAccessor, context);

        if(!useWidgetTree) {
            //plain list
           
            DojoReps.WidgetListRep.tag.append({object: widgets, propertiesToShow: funcWidgetProperties}, this.panelNode);
            
        } else {
            //tree
            var useFakeRootForDetached = false;

            var detachedWidgets = dojoAccessor.getDetachedWidgets(context);
            
            var detachedWidgetsFakeRoot = DojoReps.WidgetsTreeRep.createFakeTreeNode(detachedWidgets);            
            if(detachedWidgets && detachedWidgets.length > 0) {
                if(useFakeRootForDetached) {
                    //add the fake tree root to our widgets roots
                    widgets.push(detachedWidgetsFakeRoot);                                    
                } else {
                    widgets = widgets.concat(detachedWidgets);
                }
            }
            
            //get current selection
            var selectionPath = [];
            var mainSelection = _safeGetContext(this).dojoExtensionSelection;
            var isWidget = mainSelection && dojoAccessor.isWidgetObject(mainSelection); 
            if(isWidget) {
                selectionPath = dojoAccessor.getWidgetsExpandedPathToPageRoot(mainSelection, context);    

                //is also a detached widget?
                if(useFakeRootForDetached && dojoAccessor.isDetachedWidget(mainSelection)) {
                    //add fake widget as root of selectionPath
                    selectionPath = [detachedWidgetsFakeRoot].concat(selectionPath);
                }
            }
            
            //create treeNodes for the root widgets            
            var treeRoots = DojoReps.WidgetsTreeRep.createWrappersForWidgets(widgets, selectionPath);            
            DojoReps.WidgetsTreeRep.tag.append({object: treeRoots, propertiesToShow: funcWidgetProperties, expandPath: selectionPath}, this.panelNode);
        }

        return areThereAnyWidgets;
    },

    /**
     * Show the connections
     */
    showConnectionsInTable: function(context) {
        this.updatePanelView(
                new PanelRenderConfig(/*refreshMainPanel*/true, /*mainPanelView*/PanelRenderConfig.VIEW_CONNECTIONS, /*highlight*/true, /*scroll*/true,
                                      /*refreshSidePanel*/false, /*sidePanelView*/null), context);
    },
    
    
    /**
     * creates the filtering criteria to ask for connections to the model.
     * The criteria is built from user entered values in UI
     */
    /*obj|undefined if not valid*/_createConnectionsFilter: function(context) {
        
        //TODO add some validation , to avoid broken js
        var count = parseInt(Firebug.chrome.$("fbDojo_dojoConnCountBox").value, 10);
        var fromIndex = parseInt(Firebug.chrome.$("fbDojo_dojoConnFromIndexBox").value, 10);
        var query = Firebug.chrome.$("fbDojo_dojoConnFilterBox").value;
        
        if(!count || isNaN(count)) {
            count = undefined;
        }
        if(!fromIndex || isNaN(fromIndex)) {
            fromIndex = undefined;
        } 
        if(!query || query.trim().length == 0) {
            query = undefined;
        }

        
        var filteringCriteria = {};
        filteringCriteria['from'] = fromIndex;
        filteringCriteria['count'] = count;
               
        if(query) {
            var isJson = Str.trimLeft(query).indexOf("{") == 0;
            var actualQuery;
            if(isJson) {
                var originUrl = context.window.location.href;
                var queryObj = Json.parseJSONString(query, originUrl);
                if(!queryObj) {
                    //parsing ended in error . Notify user and exit...                    
                    return;
                }

                //create "our" query . Valid keys: object, event, context and method.        
                actualQuery = {};
                if(queryObj.object) { actualQuery.obj = queryObj.object; }
                if(queryObj.event) { actualQuery.event = queryObj.event; }
                if(queryObj.context) { actualQuery.context = queryObj.context; }
                if(queryObj.method) { actualQuery.method = queryObj.method; }
                
                if(queryObj.ignoreCase != undefined) { 
                    filteringCriteria.queryOptions = {};
                    filteringCriteria.queryOptions.ignoreCase = queryObj.ignoreCase; 
                }

            } else {
                actualQuery = query;
                //plainQueryOverFields note: 'method' must be the last, as it is expensive to format it.
                filteringCriteria.plainQueryOverFields = [ 'event' /*, 'obj', 'context'*/, 'method' ];
                //xxxPERFORMANCE
            }        
            filteringCriteria['query'] = actualQuery;
        }

        return filteringCriteria;
    },
    
    /*object*/_initFormatters: function() {
        //Formatters that know how to "stringify" an object
        if(this.formatters) {
            //already init...exit
            return this.formatters;
        }
        
        var formatters = this.formatters = {};
        formatters['obj'] = formatters['context'] = { format: function(object) 
                { 
                    var rep = Firebug.getRep(object);
                    if(rep && rep.getTitle) {
                        return rep.getTitle(object);
                    } else {
                        return object.toString();
                    }
                } 
        };
        formatters['method'] = { format: function(method) 
                {
                    return UI.getMethodLabel(method);
                }
        };        
        
        return this.formatters;
    },
       
    /**
     * Show the connections
     */
    showOnAspectObserversInTable: function(context) {
        this.updatePanelView(
                new PanelRenderConfig(/*refreshMainPanel*/true, /*mainPanelView*/PanelRenderConfig.VIEW_ONASPECTS, /*highlight*/true, /*scroll*/true,
                                      /*refreshSidePanel*/false, /*sidePanelView*/null), context);
    },
    
    /**
     * Render the On/Aspects main panel
     * !Do not invoke this method directly. it must be just invoked from the updatePanelView method.
     */
    _renderOnAspectObserversInTable: function(context) {
        this._setOption(SHOW_ONASPECTS_TABLE, context);

        if(!context.tracker) {
            return;
        }
                                
        var observers = DojoModel.OnAspectObserver.prototype.getGlobalOnAspectObservers(context.tracker);
        
        var document = this.document;
        
        // Show the visual content.
        this.onAspectObserversMessageBox.loadMessageBox(false);
        
        // There are on/aspects registered
        if (observers && observers.length > 0) {
            var self = this;
            
            var maxSuggestedObservers = DojoPrefs.getMaxSuggestedConnections(); 
            if(!context.dojo.showOnAspectObserversAnyway && (observers.length > maxSuggestedObservers)) {
                /* Warning message box *many* connections in page */
                var manyConMsgBox = new MessageBox.ActionMessageBox("ManyConnsMsgBox", this.panelNode, 
                                                                DojoPanels.$STRF('warning.manyOnAspects', [ maxSuggestedObservers ]),
                                                                DojoPanels.$STR('warning.manyOnAspects.button'),
                                                                function(actionMessageBox){
                                                                    context.dojo.showOnAspectObserversAnyway = true;
                                                                    self.showOnAspectObserversInTable(context);
                                                                });
                manyConMsgBox.loadMessageBox(true);
                return;
            }
            
            context.dojo.showOnAspectObserversAnyway = undefined;
            var sorterFunctionGenerator = function(criteriaPriorityArray){
                return function(){
                    context.priorityCriteriaArray = criteriaPriorityArray;
                    self.showConnectionsInTable.call(self, context);
                };
            };
            
            DojoReps.OnAspectObserversTableRep.tag.append({'observers': observers}, this.panelNode);
            
        } else {
            MessageBox.Messages.infoTag.append({object: DojoPanels.$STR('warning.noOnAspectsRegistered')}, this.panelNode);
        }
        
    },
    
    
    /**
     * Render the Connections view
     * !Do not invoke this method directly. it must be just invoked from the updatePanelView method.
     */
    _renderConnectionsInTable: function(context) {
        this._setOption(SHOW_CONNECTIONS_TABLE, context);

        if(!context.tracker) {
            return;
        }
        
        var filteringCriteria = this._createConnectionsFilter(context);
        if(!filteringCriteria) {
            //parsing ended in error . Notify user and exit...
            Css.setClass(Firebug.chrome.$("fbDojo_dojoConnFilterBox"), "dojoConnFilterBox-attention");
            return;
        }

        Css.removeClass(Firebug.chrome.$("fbDojo_dojoConnFilterBox"), "dojoConnFilterBox-attention");
        
        var formatters = this._initFormatters();
        
        // TODO: Add comments (priorityCriteriaArray)
        var criterias = [DojoModel.ConnectionArraySorter.OBJ,
                          DojoModel.ConnectionArraySorter.EVENT,
                           DojoModel.ConnectionArraySorter.CONTEXT,
                           DojoModel.ConnectionArraySorter.METHOD];
        
        // Sort the connection array.
        var priorityCriteriaArray = context.priorityCriteriaArray || criterias; 

        //TODO sorted table: enable again!
        var cons = DojoModel.Connection.prototype.getGlobalConnections(context.tracker, filteringCriteria, formatters);
        
        var document = this.document;
        
        // Show the visual content.
        this.connectionsMessageBox.loadMessageBox(false);
        
        // There are connections registered
        if (cons.length > 0) {
            var self = this;
            
            var maxSuggestedConns = DojoPrefs.getMaxSuggestedConnections(); 
            if(!context.dojo.showConnectionsAnyway && (cons.length > maxSuggestedConns)) {
                /* Warning message box *many* connections in page */
                var manyConMsgBox = new MessageBox.ActionMessageBox("ManyConnsMsgBox", this.panelNode, 
                                                                DojoPanels.$STRF('warning.manyConnections', [ maxSuggestedConns ]),
                                                                DojoPanels.$STR('warning.manyConnections.button'),
                                                                function(actionMessageBox){
                                                                    context.dojo.showConnectionsAnyway = true;
                                                                    self.showConnectionsInTable(context);
                                                                });
                manyConMsgBox.loadMessageBox(true);
                return;
            }
            
            context.dojo.showConnectionsAnyway = undefined;
            var sorterFunctionGenerator = function(criteriaPriorityArray){
                return function(){
                    context.priorityCriteriaArray = criteriaPriorityArray;
                    self.showConnectionsInTable.call(self, context);
                };
            };
            
            DojoReps.ConnectionsTableRep.tag.append({connections: cons,
                                                     priorityCriteriaArray: priorityCriteriaArray,
                                                     sorterObject: sorterFunctionGenerator([DojoModel.ConnectionArraySorter.OBJ,
                                                                                            DojoModel.ConnectionArraySorter.EVENT,
                                                                                              DojoModel.ConnectionArraySorter.CONTEXT,
                                                                                              DojoModel.ConnectionArraySorter.METHOD]),
                                                                                              
                                                     sorterEvent: sorterFunctionGenerator([DojoModel.ConnectionArraySorter.EVENT,
                                                                                            DojoModel.ConnectionArraySorter.OBJ,
                                                                                              DojoModel.ConnectionArraySorter.CONTEXT,
                                                                                              DojoModel.ConnectionArraySorter.METHOD]),
                                                                                              
                                                     sorterContext: sorterFunctionGenerator([DojoModel.ConnectionArraySorter.CONTEXT,
                                                                                              DojoModel.ConnectionArraySorter.METHOD,
                                                                                              DojoModel.ConnectionArraySorter.OBJ,
                                                                                              DojoModel.ConnectionArraySorter.EVENT]),
                                                                                              
                                                     sorterMethod: sorterFunctionGenerator([DojoModel.ConnectionArraySorter.METHOD,
                                                                                            DojoModel.ConnectionArraySorter.CONTEXT,
                                                                                              DojoModel.ConnectionArraySorter.OBJ,
                                                                                              DojoModel.ConnectionArraySorter.EVENT])}, this.panelNode);
            
        } else {
            MessageBox.Messages.infoTag.append({object: DojoPanels.$STR('warning.noConnectionsRegistered')}, this.panelNode);
        }
        
    },
    
    /**
     * Show the Subscriptions
     */
    showSubscriptions: function(context) {
        this.updatePanelView(
                new PanelRenderConfig(/*refreshMainPanel*/true, /*mainPanelView*/PanelRenderConfig.VIEW_SUBSCRIPTIONS, /*highlight*/true, /*scroll*/true,
                                      /*refreshSidePanel*/false, /*sidePanelView*/null), context);
    },
        
    /**
     * Render the Subscriptions view
     * !Do not invoke this method directly. it must be just invoked from the updatePanelView method.
     */
    _renderSubscriptions: function(context) {
        this._setOption(SHOW_SUBSCRIPTIONS, context);
        
        if(!context.tracker) {
            return;
        }

        var document = this.document;
        
        // Show the visual content.
        this.subscriptionsMessageBox.loadMessageBox(false);
        
        // There are connections registered
        var len = DojoModel.Subscription.prototype.getGlobalSubscriptionsCount(context.tracker); 
        if (len > 0) {
            
            var maxSuggestedSubs = DojoPrefs.getMaxSuggestedSubscriptions(); 
            if(!context.dojo.showSubscriptionsAnyway && (len > maxSuggestedSubs)) {
                var self = this;
                /* Warning message box *many* subscriptions in page */
                var manySubsMsgBox = new MessageBox.ActionMessageBox("ManySubsMsgBox", this.panelNode, 
                                                                DojoPanels.$STRF('warning.manySubscriptions', [ maxSuggestedSubs ]),
                                                                DojoPanels.$STR('warning.manySubscriptions.button'),
                                                                function(actionMessageBox){
                                                                    context.dojo.showSubscriptionsAnyway = true;
                                                                    self.showSubscriptions(context);
                                                                });
                manySubsMsgBox.loadMessageBox(true);
            
            } else {
                context.dojo.showSubscriptionsAnyway = undefined;
                var subs = DojoModel.Subscription.prototype.getGlobalSubscriptions(context.tracker);
                DojoReps.SubscriptionsRep.tag.append({object: subs}, this.panelNode);
            }

        } else {
            MessageBox.Messages.infoTag.append({object: DojoPanels.$STR('warning.noSubscriptionsRegistered')}, this.panelNode);
        }
    },
    
    /**
     * Support for panel activation.
     */
    onActivationChanged: function(enable)
    {
        if (enable) {
            DojoExtension.dojofirebugextensionModel.addObserver(this);
        } else {
            DojoExtension.dojofirebugextensionModel.removeObserver(this);
        }
    }

}); //end dojofirebugextensionPanel

    
/***********************************************************************************************************************/

// ***************************************************************
// exported classes
// ***************************************************************    

    DojoPanels.dojofirebugextensionPanel = dojofirebugextensionPanel; 
    
    /**
     * function to register this panel (and sidepanels) into Firebug engine
     */
    DojoPanels.dojofirebugextensionPanel.registerPanel = function() {
        Firebug.registerPanel(DojoPanels.dojofirebugextensionPanel);
        Firebug.registerPanel(DojoPanels.DojoInfoSidePanel);
        Firebug.registerPanel(DojoPanels.ConnectionsSidePanel);
        Firebug.registerPanel(DojoPanels.SubscriptionsSidePanel);
        Firebug.registerPanel(DojoPanels.OnAspectSidePanel);    
        Firebug.registerPanel(DojoPanels.WidgetPropertiesSidePanel);
        Firebug.registerPanel(DojoPanels.DojoDOMSidePanel);
        Firebug.registerPanel(DojoPanels.DojoHTMLPanel);
    };

    
// ***************************************************************
// exported static methods
// ***************************************************************    

    
    var exportedUIMethods = {};

    var _getDojoPanel = exportedUIMethods.getDojoPanel = function(context) {
        return context.getPanel(DojoPanels.mainPanelName);
    };

    /**
     * show the about message
     */
    exportedUIMethods.onAboutButton = function(/*fbug context*/context) {
        _getDojoPanel(context).showAbout();
    };

    /**
     * display all connections
     */
    exportedUIMethods.onShowConnectionsInTableButton = function(/*fbug context*/context) {
        _getDojoPanel(context).showConnectionsInTable(context);
    };

    /**
     * display all widgets from dijit registry
     */
    exportedUIMethods.onShowWidgetsButton = function(/*fbug context*/context) {
        _getDojoPanel(context).showWidgets(context);
    };
    
    /**
     * display all subscriptions
     */
    exportedUIMethods.onShowSubscriptionsButton = function(/*fbug context*/context) {
        _getDojoPanel(context).showSubscriptions(context);
    };

    exportedUIMethods.onShowOnAspectObserversButton = function(/*fbug context*/context) {
        _getDojoPanel(context).showOnAspectObserversInTable(context);
    };
        
    
    //methods accessible from dojo.xul
    if(!Firebug.DojoExtension.ui) {
        Firebug.DojoExtension.ui = exportedUIMethods;    
    } else {
        for(var i in exportedUIMethods){
            if(!(i in Firebug.DojoExtension.ui)){
                Firebug.DojoExtension.ui[i] = exportedUIMethods[i];
            }
        }
    }
    

/***********************************************************************************************************************/
    
    return dojofirebugextensionPanel;
});
