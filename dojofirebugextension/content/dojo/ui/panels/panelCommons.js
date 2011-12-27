/* Released under BSD license (see license.txt) */
/*
 * Copyright IBM Corporation 2010, 2010. All Rights Reserved. 
 * U.S. Government Users Restricted Rights -  Use, duplication or disclosure restricted by GSA ADP 
 * Schedule Contract with IBM Corp. 
 */


/**
 * Common functions for panels
 * @author preyna@ar.ibm.com
 * @author fergom@ar.ibm.com
 */
define([
        "firebug/firebug",
        "firebug/firefox/firefox",
        "firebug/firefox/window",
        "firebug/lib/dom",
        "firebug/lib/object",
        "firebug/lib/trace",
        "dojo/core/dojofirebugextension",
        "dojo/core/dojomodel",
        "dojo/core/prefs",
        "dojo/ui/ui"
       ], function dojoPanelsFactory(Firebug, Firefox, Win, Dom, Obj, FBTrace, DojoExtension, DojoModel, DojoPrefs, UI)
{
    
    var DojoPanels = {};

    // **************************************************************************************

    DojoPanels.mainPanelName = "dojofirebugextension";
    

    var $STR = DojoPanels.$STR = function(key) {
        return UI.$STR(key);    
    };    
    
    var $STRF = DojoPanels.$STRF = function(key, args) {
        return UI.$STRF(key, args);
    };

    var addStyleSheet = DojoPanels.addStyleSheet = function(doc) {
        UI.addStyleSheet(doc);
    };        

    var getDojoAccessor = DojoPanels.getDojoAccessor = function(context) {
        return DojoExtension.getDojoAccessor(context);
    };

    var getDojoDebugger = DojoPanels.getDojoDebugger = function(context) {
        return DojoExtension.getDojoDebugger(context);
    };
    
    /*context*/var _safeGetContext = DojoPanels._safeGetContext = function(panel) {
        return DojoExtension.safeGetContext(panel);
    };

    
// ****************************************************************
// Common Mixins for our Panels
// ****************************************************************

    
    
var CONNECTIONS_BP_OPTION = "connections_bp_option";
var SUBSCRIPTIONS_BP_OPTION = "subscriptions_bp_option";
var ONASPECT_BP_OPTION = "onAspects_bp_option";
var DOCUMENTATION_OPTION = "documentation_option";
var WIDGET_OPTION = "widget_option";

/**
 * mixin to add common context menu items (breakpoints, etc)
 * FIXME this mixin knows a lot about specific classes and panels!
 */
var DojoPanelMixin =  {
            
    /**
     * @override
     */    
    getContextMenuItems: function(realObject, target) {
        var items = [];
    
        // Check if the selected object is a connection
        var conn = this._getReferencedObjectFromNodeWithType(target, "dojo-connection");
        if (conn){
            items = this._getConnectionContextMenuItems(conn);
        }
        
        // Check if the selected object is a subscription
        var sub = this._getReferencedObjectFromNodeWithType(target, "dojo-subscription");
        if (sub){
            items = this._getSubscriptionContextMenuItems(sub);
        }

        // Check if the selected object is a on/aspect
        var sub = this._getReferencedObjectFromNodeWithType(target, "dojo-onaspectobserver");
        if (sub){
            items = this._getOnAspectObserversContextMenuItems(sub);
        }
        
        if (realObject) {
            var docItems = this.getDocumentationContextMenuItems(realObject, target);
            if(docItems) {
                items = items.concat(docItems);
            }
        }

        // Check if the selected object is a widget
        var widget = this._getReferencedObjectFromNodeWithType(target, "dojo-widget");
        if (widget){
            items = items.concat(this._getWidgetContextMenuItems(widget));
        } 

        // Check if the selected object at least has connections and/or subscriptions
        var trackedObj = this._getReferencedObjectFromNodeWithType(target, "dojo-tracked-obj");
        if(trackedObj) {
            var hasConns = this._hasConnections(trackedObj); 
            var hasSubs = this._hasSubscriptions(trackedObj);
            var hasOnAspects = this._hasOnAspectObservers(trackedObj);
            if(hasConns || hasSubs || hasOnAspects) {
                items.push("-"); //separator
            }
            if(hasConns) {
                items = items.concat(this._getMenuItemsForObjectWithConnections(trackedObj));
            }
            if(hasSubs) {
                items = items.concat(this._getMenuItemsForObjectWithSubscriptions(trackedObj));
            }
            if(hasOnAspects) {
                items = items.concat(this._getMenuItemsForObjectWithOnAspectObservers(trackedObj));
            }                       
        }

        // Check if the selected object is a connection event
        var /*IncomingConnectionsDescriptor*/ incDesc = this._getReferencedObjectFromNodeWithType(target, "dojo-eventFunction");
        if (incDesc){
            var fnEventLabel = (typeof(incDesc.event) == "string") ? incDesc.event : null;
            items = items.concat(this._getFunctionContextMenuItems(incDesc.getEventFunction(), 'menuitem.breakon.event', fnEventLabel));
        }
        
        // Check if the selected object is a listener function
        var /*OutgoingConnectionsDescriptor*/ outDesc = this._getReferencedObjectFromNodeWithType(target, "dojo-targetFunction");
        if (outDesc){
            var fnListenerLabel = (typeof(outDesc.method) == "string") ? outDesc.method : null;
            items = items.concat(this._getFunctionContextMenuItems(outDesc.getListenerFunction(), 'menuitem.breakon.target', fnListenerLabel));
        }
        
        return items;

    },
    
    /**
     * returns the referencedObject associated to an ancestor node with class objectType
     */
    _getReferencedObjectFromNodeWithType: function(target, objectType) {
        var connNode = Dom.getAncestorByClass(target, objectType);
        if(!connNode) {
            return;
        }
        
        return connNode.referencedObject;
    },
    
    /*array*/_getFunctionContextMenuItems: function(func, msgKey, label){
        var context = this.context;
        var dojoDebugger = getDojoDebugger(context);

        //info about the function.
        var listener = dojoDebugger.getDebugInfoAboutFunction(context, func, label);

        return [
            { label: $STRF(msgKey, [listener.getFnName()]), nol10n: true, disabled: !listener.fnExists, type: "checkbox", checked: listener.hasBreakpoint(), command: Obj.bindFixed(dojoDebugger.toggleBreakpointInFunction, dojoDebugger, listener)}
        ];
    },
    
    /*array*/_getWidgetContextMenuItems: function(widget){
        //nothing to do
        return [];
    },
    
    /*array*/_getConnectionContextMenuItems: function(conn) {
        var context = this.context;
        
        var dojoDebugger = getDojoDebugger(context);

        //info about listener fn..
        var fnListener = conn.getListenerFunction();
        //var fnListenerLabel = (typeof(conn.method) == "string") ? conn.method : null;
        var fnListenerLabel = UI.getMethodLabel(conn.method);
        var listener = dojoDebugger.getDebugInfoAboutFunction(context, fnListener, fnListenerLabel);

        //info about original fn..
        var fnModel = conn.getEventFunction();        
        var fnEventLabel = (typeof(conn.event) == "string") ? conn.event : null;
        //var fnEventLabel = UI.getMethodLabel(conn.event);
        var model = dojoDebugger.getDebugInfoAboutFunction(context, fnModel, fnEventLabel);
        
        if(FBTrace.DBG_DOJO_CONTEXTMENU) {
            FBTrace.sysout("event function: " , fnModel);
            FBTrace.sysout("event label: " , fnEventLabel);
            FBTrace.sysout("event model: " , model);
        }        
        
        //info about place where the connection was made
        var caller = conn.callerInfo;
        
        var connectPlaceCallerFnName;
        if(DojoPrefs._isBreakPointPlaceSupportDisabled()) {            
            connectPlaceCallerFnName = $STR('menuitem.breakon.disabled');
        } else {
            connectPlaceCallerFnName = (caller) ? caller.getFnName() : null;
        }
        
        return [
            { label: $STRF('menuitem.breakon.target', [listener.getFnName()]), nol10n: true, disabled: !listener.fnExists, type: "checkbox", checked: listener.hasBreakpoint(), command: Obj.bindFixed(dojoDebugger.toggleBreakpointInFunction, dojoDebugger, listener), optionType: CONNECTIONS_BP_OPTION },
            { label: $STRF('menuitem.breakon.event', [model.getFnName()]), nol10n: true, disabled: !model.fnExists, type: "checkbox", checked: model.hasBreakpoint(), command: Obj.bindFixed(dojoDebugger.toggleBreakpointInFunction, dojoDebugger, model), optionType: CONNECTIONS_BP_OPTION },
            { label: $STRF('menuitem.breakon.connect', [connectPlaceCallerFnName]), nol10n: true, disabled: (!caller || !caller.fnExists), type: "checkbox", checked: (caller && caller.hasBreakpoint()), command: Obj.bindFixed(dojoDebugger.toggleBreakpointInFunction, dojoDebugger, caller), optionType: CONNECTIONS_BP_OPTION }
        ];

    },
    
    /*array*/_getMenuItemsForObjectWithConnections: function(/*Object*/obj) {
        if (!obj) {
            return [];
        }
        
        return [
            {label: $STR('menuitem.Show Connections'), nol10n: true, command: Obj.bindFixed(this._showConnections, this, obj), disabled: !this._hasConnections(obj), optionType: WIDGET_OPTION}
        ];        
    },

    /*array*/_getMenuItemsForObjectWithSubscriptions: function(/*Object*/obj) {
        if (!obj) {
            return [];
        }
        
        return [
                {label: $STR('menuitem.Show Subscriptions'), nol10n: true, command: Obj.bindFixed(this._showSubscriptions, this, obj), disabled: !this._hasSubscriptions(obj), optionType: WIDGET_OPTION }
        ];        
    },

    /*array*/_getMenuItemsForObjectWithOnAspectObservers: function(/*Object*/obj) {
        if (!obj) {
            return [];
        }
        
        return [
            {label: $STR('menuitem.Show OnAspects'), nol10n: true, command: Obj.bindFixed(this._showOnAspectObservers, this, obj), disabled: !this._hasOnAspectObservers(obj), optionType: WIDGET_OPTION}
        ];        
    },

    /*array*/_getSubscriptionContextMenuItems: function(sub) {
        var context = this.context;
        
        var dojoDebugger = getDojoDebugger(context);

        //info about listener fn..
        var fnListener = sub.getListenerFunction();
        var fnListenerLabel = (typeof(sub.method) == "string") ? sub.method : null;
        var listener = dojoDebugger.getDebugInfoAboutFunction(context, fnListener, fnListenerLabel);

        //info about place where the subscription was made
        var caller = sub.callerInfo;
        
        var subscribePlaceCallerFnName;
        if(DojoPrefs._isBreakPointPlaceSupportDisabled()) {
            subscribePlaceCallerFnName = $STR('menuitem.breakon.disabled');
        } else {
            subscribePlaceCallerFnName = (caller) ? caller.getFnName() : null;
        }

        return [
            { label: $STRF('menuitem.breakon.target', [listener.getFnName()]), nol10n: true, disabled: !listener.fnExists, type: "checkbox", checked: listener.hasBreakpoint(), command: Obj.bindFixed(dojoDebugger.toggleBreakpointInFunction, dojoDebugger, listener), optionType: SUBSCRIPTIONS_BP_OPTION },
            { label: $STRF('menuitem.breakon.subscribe', [subscribePlaceCallerFnName]), nol10n: true, disabled: (!caller || !caller.fnExists), type: "checkbox", checked: (caller && caller.hasBreakpoint()), command: Obj.bindFixed(dojoDebugger.toggleBreakpointInFunction, dojoDebugger, caller), optionType: SUBSCRIPTIONS_BP_OPTION }
        ];

    },
    
    /*array*/_getOnAspectObserversContextMenuItems: function(observer) {
        var context = this.context;
        
        var dojoDebugger = getDojoDebugger(context);

        //info about listener fn..
        var fnListener = observer.getListenerFunction();
        var fnListenerLabel = UI.getMethodLabel(fnListener);
        var listener = dojoDebugger.getDebugInfoAboutFunction(context, fnListener, fnListenerLabel);

        //info about original fn..
        var fnModel = observer.getEventFunction();
        var fnEventLabel = (typeof(observer.type) == "string") ? observer.type : null;
        //var fnEventLabel = UI.getMethodLabel(observer.type);        
        var model = dojoDebugger.getDebugInfoAboutFunction(context, fnModel, fnEventLabel);
        
        if(FBTrace.DBG_DOJO_CONTEXTMENU) {
            FBTrace.sysout("event function: " , fnModel);
            FBTrace.sysout("event label: " , fnEventLabel);
            FBTrace.sysout("event model: " , model);
        }        

        //info about place where the connection was made
        var caller = observer.callerInfo;
        
        var observerPlaceCallerFnName;
        if(DojoPrefs._isBreakPointPlaceSupportDisabled()) {            
            observerPlaceCallerFnName = $STR('menuitem.breakon.disabled');
        } else {
            observerPlaceCallerFnName = (caller) ? caller.getFnName() : null;
        }
        
        return [
            { label: $STRF('menuitem.breakon.target', [listener.getFnName()]), nol10n: true, disabled: !listener.fnExists, type: "checkbox", checked: listener.hasBreakpoint(), command: Obj.bindFixed(dojoDebugger.toggleBreakpointInFunction, dojoDebugger, listener), optionType: ONASPECT_BP_OPTION },
            { label: $STRF('menuitem.breakon.event', [model.getFnName()]), nol10n: true, disabled: !model.fnExists, type: "checkbox", checked: model.hasBreakpoint(), command: Obj.bindFixed(dojoDebugger.toggleBreakpointInFunction, dojoDebugger, model), optionType: ONASPECT_BP_OPTION },
            { label: $STRF('menuitem.breakon.on_aspect', [observerPlaceCallerFnName]), nol10n: true, disabled: (!caller || !caller.fnExists), type: "checkbox", checked: (caller && caller.hasBreakpoint()), command: Obj.bindFixed(dojoDebugger.toggleBreakpointInFunction, dojoDebugger, caller), optionType: ONASPECT_BP_OPTION }
        ];

    },
    
    /*boolean*/_hasConnections: function(widget) {
        var api = _safeGetContext(this).tracker;
        return (!api) ? false : DojoModel.Connection.prototype.areThereAnyConnectionsFor(api, widget);
    },
    
    /*boolean*/_hasSubscriptions: function(widget) {
        var api = _safeGetContext(this).tracker;        
        return (!api) ? false : DojoModel.Subscription.prototype.areThereAnySubscriptionFor(api, widget);
    },
    
    /*boolean*/_hasOnAspectObservers: function(widget) {
        var api = _safeGetContext(this).tracker;
        return (!api) ? false : DojoModel.OnAspectObserver.prototype.areThereAnyOnAspectsFor(api, widget);
    },
        
    _showConnections: function(widget, context) {
        DojoPanels.dojofirebugextensionPanel.prototype.showObjectInConnectionSidePanel(widget);
    },
    
    _showSubscriptions: function(widget, context) {
        DojoPanels.dojofirebugextensionPanel.prototype.showObjectInSubscriptionSidePanel(widget);
    },

    _showOnAspectObservers: function(widget, context) {
        DojoPanels.dojofirebugextensionPanel.prototype.showObjectInOnAspectsSidePanel(widget);
    },
    
    /*array*/getDocumentationContextMenuItems: function(realObject, target) {
        //'this' is a panel instance
        var context = this.context;
        var dojoAccessor = getDojoAccessor(context);
        var docUrl = dojoAccessor.getDojoApiDocURL(realObject, context);
        
        var refDocUrl = dojoAccessor.getReferenceGuideDocUrl(realObject, context);
        
        if(!docUrl && !refDocUrl) {
            return;
        }
        
        return [
                "-",
                { label: $STR('menuitem.Open_Doc_In_New_Tab'), nol10n: true, disabled: !docUrl, command: Obj.bindFixed(this.openBrowserTabWithURL, this, docUrl, context), optionType: DOCUMENTATION_OPTION },
                "-",
                { label: $STR('menuitem.Open_Doc_From_RefGuide_In_New_Tab'), nol10n: true, disabled: !refDocUrl, command: Obj.bindFixed(this.openBrowserTabWithURL, this, refDocUrl, context), optionType: DOCUMENTATION_OPTION }
            ];
    },
    
    openBrowserTabWithURL: function(url, context) {
        Win.openNewTab(url);
    },
    
    openBrowserWindowWithURL: function(url, context) {
        //preyna: i don't think this works ...
        var h = context.window.height;
        var w = context.window.width;
        var args = {
                browser: context.browser
        };
        Firefox.openWindow("DojoDoc", url, "width="+w+",height="+h, args);
    }
    
}; // end DojoPanelMixin


var ActivablePanelPlusMixin = Obj.extend(Firebug.ActivablePanel, DojoPanelMixin);


var SimplePanelPlusMixin = Obj.extend(Firebug.Panel, DojoPanelMixin);
SimplePanelPlusMixin = Obj.extend(SimplePanelPlusMixin, {
    /**
     * The select method is extended to ensure the selected object
     * is the same one at this side panel and in the main panel.
     * @override 
     */
    select: function(object, forceUpdate) {
        var mainSO = _safeGetContext(this).dojoExtensionSelection;
        if (mainSO == object) {
            Firebug.Panel.select.call(this, object, true);
        }
    }
});


/***********************************************************************************************************************/

// ***************************************************************
// exported classes
// ***************************************************************    
    DojoPanels.DojoPanelMixin = DojoPanelMixin;
    DojoPanels.ActivablePanelPlusMixin = ActivablePanelPlusMixin;
    DojoPanels.SimplePanelPlusMixin = SimplePanelPlusMixin;
    
    return DojoPanels;
});
