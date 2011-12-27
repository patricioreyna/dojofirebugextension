/* Released under BSD license (see license.txt) */
/*
 * Copyright IBM Corporation 2010, 2010. All Rights Reserved. 
 * U.S. Government Users Restricted Rights -  Use, duplication or disclosure restricted by GSA ADP 
 * Schedule Contract with IBM Corp. 
 */


/**
 * Subscriptions side panel
 * @author preyna@ar.ibm.com
 * @author fergom@ar.ibm.com
 */
define([
        "firebug/firebug",
        "firebug/lib/object",
        "firebug/lib/trace",
        "dojo/core/dojomodel",
        "dojo/ui/dojoreps",
        "dojo/ui/messageBox",
        "dojo/ui/panels/panelCommons"
       ], function subsPanelsFactory(Firebug, Obj, FBTrace, DojoModel, DojoReps, MessageBox, DojoPanels)
{

/**
 * @panel Subscriptions Side Panel.
 * This side panel shows the subscriptions information for the selected object. 
 */
var SubscriptionsSidePanel = function() {};
SubscriptionsSidePanel.prototype = Obj.extend(DojoPanels.SimplePanelPlusMixin,
{
    name: "subscriptionsSidePanel",
    title: DojoPanels.$STR('panel.subscriptions.title'),
    parentPanel: DojoPanels.mainPanelName,
    order: 3,
    enableA11y: true,
    deriveA11yFrom: "console",
    //breakable: true,
    editable: false,

    initialize: function() {
        Firebug.Panel.initialize.apply(this, arguments);
        DojoPanels.addStyleSheet(this.document);
    },

    /**
     * Returns a number indicating the view's ability to inspect the object.
     * Zero means not supported, and higher numbers indicate specificity.
     */
    supportsObject: function(object, type) {
        var api = DojoPanels._safeGetContext(this).tracker;
        return (api && DojoModel.Subscription.prototype.areThereAnySubscriptionFor(api, object)) ? 2000 : 0;
    },
    
    /**
     * triggered when there is a Firebug.chrome.select() that points to the parent panel.
     */
    updateSelection: function(object) {
        var api = DojoPanels._safeGetContext(this).tracker;
        var trackingInfo = (api) ? api.getTrackingInfoFor(object, true) : null;
        
        if(trackingInfo && !DojoModel.Subscription.prototype.isEmpty(trackingInfo)) {
            DojoReps.SubscriptionsArrayRep.tag.replace({ 'object': { 'object': object, 'trackingInfo': trackingInfo }}, this.panelNode);
        } else {
            MessageBox.Messages.infoTag.replace({object: DojoPanels.$STR('warning.noSubscriptionsInfoForTheObject')}, this.panelNode);
        }
    }

});

    
/***********************************************************************************************************************/

// ***************************************************************
// exported classes
// ***************************************************************    

    DojoPanels.SubscriptionsSidePanel = SubscriptionsSidePanel;

    
    
    return SubscriptionsSidePanel;
});
